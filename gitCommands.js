const { readConfig, getLabelsPushOptionFromConfig, shouldDeleteBranch, getBranchSettings, allowToCreateTempBranches, getMainBranch, isDraft } = require('./configHelper');
const { runGitCommand, runGitCommandWithBranch, getCurrentBranchName, uncomittedChangesExist, checkSyncWithServer,
   deleteBranchesLocally, doesBranchExistLocally, doesBranchExistOnServer, isUpstreamSet, stageAndCommit, squashCommitsBeforeBase } = require('./gitHelper');
const { askForBranchNameAndType, askUserForAction, confirmReset, askForCommitMessage } = require('./inquirerHelper');
const notifier = require('node-notifier');
const { exec } = require('child_process');
const config = readConfig();
const { namingConventions } = config.branchesOptions;

async function findLinksAndOpenThem(pushCommandResult) {
  return new Promise((resolve, reject) => {
    try {
      const urlMatch = pushCommandResult.match(/(http[s]?:\/\/[\S]+)/); // Regex to find URLs in the output
      if (urlMatch) {
        const mergeRequestUrl = urlMatch[0];
        if (isValidUrl(mergeRequestUrl)) {
          console.log('Opening merge request URL:', mergeRequestUrl);
          // Platform-specific commands to open the URL in the default browser
          switch (process.platform) {
            case 'darwin': // macOS
              exec(`open ${mergeRequestUrl}`);
              break;
            case 'win32': // Windows
              exec(`start ${mergeRequestUrl}`);
              break;
            default: // Linux and others
              exec(`xdg-open ${mergeRequestUrl}`);
              break;
          }
        }
      }
      resolve();
  } catch (error) {
      reject(error);
      throw new Error(`Error finding and opening links: ${error.message}`);
    }
  });
}

async function handlePush() {
  const currentBranch = await getCurrentBranchName();
  await createMergeRequestAndPush(currentBranch, false, false, false, false);
}

async function handleCreateMr(targetBranch) {
  const mainBranch = getMainBranch();
  const branchToCreateMergeRequestTo = targetBranch || mainBranch;

  if (!branchToCreateMergeRequestTo) { 
    return "No target branch specified. Please provide a target branch to create a merge request to or ensure you have a main branch specified in your config."
  }

  const isDraftPR = isDraft(branchToCreateMergeRequestTo);

  let shouldDelete = false;
  if (branchToCreateMergeRequestTo === mainBranch) {
    shouldDelete = shouldDeleteBranch();
  }

  await createMergeRequestAndPush(targetBranch, isDraftPR, shouldDelete);
}

async function createMergeRequestAndPush(targetBranch, isDraftPR, shouldDeleteBranchAfterMergeOnServer, isTempBranch = false, includeOptions = true) {
  try {

    const currentBranch = await getCurrentBranchName();

    if (await uncomittedChangesExist()) {
      const actions = {
        'reset-server': 'Reset Changes.',
        'stash': 'Stash Changes.',
        'commit-squash': 'Commit my changes and squash them.',
        'commit': 'Commit only.',
        'abort': `just abort the operation and do nothing.`,
      };

      const userResponse = await askUserForAction(actions, "You have uncommitted changes, what would you like to do?");
      if (userResponse === 'reset-server') {
        await handleBranchReseting(currentBranch, false);
      } else {
        if (actions[userResponse] && userResponse !== 'abort') {
          await executeAction(userResponse);
        } else {
          console.log('Operation aborted or invalid option selected.');
          return;
        }
      }
    }

    let shouldForce = false;
    const existOnServer = await doesBranchExistOnServer(currentBranch);
    const canPushToServer = existOnServer ? await checkSyncWithServer(currentBranch) : true;

    if (!isTempBranch) {
      if (existOnServer && !canPushToServer) {
        const actions = {
          'force': 'Force push changes (you will lose any commits on the server).',
          'abort': `just abort the operation and do nothing.`,
        };
  
        const userResponse = await askUserForAction(actions, `Branch "${currentBranch}" already exists on the server and not in sync with local, what would you like to do?`);
        if (userResponse === 'force') {
          shouldForce = true;
        } else {
          console.log('Operation aborted or invalid option selected.');
          return;
        }
      }
    }

    let options = '';

    if (includeOptions) {
      if (shouldForce || isTempBranch) {
        options += '-f ';
      }
  
      options += `-o merge_request.create -o merge_request.target=${targetBranch} ${getLabelsPushOptionFromConfig(targetBranch)}`;
      if (isDraftPR) {
        options += ' -o merge_request.draft';
      }
  
      if (shouldDeleteBranchAfterMergeOnServer) {
        options += ' -o merge_request.remove_source_branch';
      }
    }

    const upsreamExist = await isUpstreamSet(currentBranch);
    if (!upsreamExist) {
      await runGitCommand(`branch --set-upstream-to=origin/${currentBranch}`);
    }

    let result = '';
    if (existOnServer && canPushToServer) {
      await runGitCommand('commit --allow-empty -m "Trigger PR creation"');
      result = await runGitCommand(`push -f origin ${currentBranch} ${options}`, true);
    } else if (!existOnServer) {
      result = await runGitCommand(`push origin ${currentBranch} ${options}`, true);
    }

    if (result) {
      await findLinksAndOpenThem(result.trim());
    }
  } catch (error) {
    console.error(`Failed to create merge request for ${targetBranch}:`, error);
  }
}

async function createTempBranch(additionalIdentifier = '') {
  try {
    const currentBranch = await getCurrentBranchName();
    const branchNameToCreate = `${currentBranch}-boost-temp${additionalIdentifier}`;
    await runGitCommand(`checkout -b ${branchNameToCreate}`);
    return branchNameToCreate; // Branch created successfully
  } catch (error) {
    console.error(`Failed to create temporary branch: ${error.message}`);
    return undefined; // Failed to create branch
  }
}

async function createAllMergeRequestsAndPush() {
  try {
    const allowedToCreateTempBranches = allowToCreateTempBranches();
    if (!allowedToCreateTempBranches) {
      console.log(`Creating temp branches are disabled in your config, enable them to create mutiple merge requests to different target branch`);
      return;
    }
  
    // save the original branch name before you attempt to create and checkout the temp branches
    const mainBranch = getMainBranch();
    // create for main first
    const isDraftForMainPR = isDraft(mainBranch);
    const shouldDeleteAfterMerge = shouldDeleteBranch();
    await createMergeRequestAndPush(mainBranch, isDraftForMainPR, shouldDeleteAfterMerge);
    
    const originalBranch = await getCurrentBranchName();
    const createdTempBranches = [];
    for (const { name: targetBranch, isDraftPR } of getBranchSettings()) {
      // already created for the first environment (the main branch)
      if (targetBranch === mainBranch) {
        continue;
      }

    // create temp branch
    const tempBranchName = await createTempBranch(targetBranch);
    if (tempBranchName) {
      // params passed to delete temp branch on server and force the push (only for temp branches)
      await createMergeRequestAndPush(targetBranch, isDraftPR, true, true);
      createdTempBranches.push(tempBranchName);
    } else {
      console.error(`Unable to create PR to ${targetBranch}`);
    }

  if (createdTempBranches.length > 0) {
    await runGitCommand(`checkout ${originalBranch}`);
    // delete all temp branches locally
    deleteBranchesLocally(createdTempBranches);
  }
      }
  } catch (error) { 
    console.error(error);
  }
}

async function commitAndCreatePR(commitMessage) {
  if (!commitMessage) {
    console.error('No Commit message specified');
    return;
  }
  const status = await uncomittedChangesExist();

  if (status) {
    // Unstaged changes exist, proceed with adding and committing
    await runGitCommand('add .');
    await runGitCommand(`commit -m "${commitMessage}"`);
    await createAllMergeRequestsAndPush();
  } else {
    // No unstaged changes, log a message and skip add/commit
    console.log('No changes to commit. if you intend to just create the merge request consider using push-mr or push-mr-all aliases');
  }
}

async function checkForPotentialConflicts(targetBranch) {
  const currentBranch = await getCurrentBranchName();
  try {
    const mergeBase = await runGitCommand(`merge-base ${currentBranch} ${targetBranch}`);
    const changesInTarget = await runGitCommand(`diff --name-only ${mergeBase} ${targetBranch}`);
    const changesInCurrent = await runGitCommand(`diff --name-only ${mergeBase}`);

    const conflictingFiles = changesInTarget.split('\n').filter(fileName => changesInCurrent.includes(fileName));

    if (conflictingFiles.length > 0) {
      notifier.notify({
        title: 'Potential Merge Conflicts Detected',
        message: `Your branch ${currentBranch} may have conflicts with ${targetBranch}. Please check the following files: ${conflictingFiles.join(', ')}`,
        sound: true,
      });
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Error checking for potential conflicts: ${error}`);
    return false;
  }
}

async function smartBranchCreation(userRequestBaseBranchName = undefined) {
  
  const { branchType, newBranchName } = await askForBranchNameAndType();
  const { defaultBaseBranch } = namingConventions[branchType];
  
  if (await doesBranchExistLocally(newBranchName)) {
    console.error('branch already exist locally');
    return;
  }

  if (!userRequestBaseBranchName && !defaultBaseBranch) {
    throw new Error('Default base branch not provided as argument and not found in config.');
  }

  // If the user has not provided a base branch, use the default from the config
  if (defaultBaseBranch && userRequestBaseBranchName === undefined) {
    if (await getCurrentBranchName() === defaultBaseBranch) {
      await createNewBranchFromDefaultBranchWhileChecked(defaultBaseBranch, newBranchName);
    } else if (await getCurrentBranchName() !== defaultBaseBranch) {
      await createNewBranchFromDefaultBranchWhileNOTChecked(defaultBaseBranch, newBranchName);
    }
  } // If the user has provided a base branch, use that
  else if (userRequestBaseBranchName !== undefined) {
    console.error('this function not supported to be used yet');
  }
}
async function handleBranchReseting(defaultBaseBranch, shouldConfirm = true) {
  if (shouldConfirm) {
    const confirmResetResult = await confirmReset(defaultBaseBranch);
    if (confirmResetResult)  {
      await executeAction('reset-server', defaultBaseBranch); 
    }
  } else {
    await executeAction('reset-server', defaultBaseBranch);
  }
}
// ex: creating a new branch from master while you are on checked out on master
async function createNewBranchFromDefaultBranchWhileChecked(defaultBaseBranch, newRequestedBranchName) {
  const uncommittedChanges = await uncomittedChangesExist();
  if (uncommittedChanges) {
    console.log('Uncommitted changes detected. Stashing changes before creating new branch.');
    await runGitCommand("stash");
    console.log("Stashed changes successfully. Resetting current branch...");
    await handleBranchReseting(defaultBaseBranch);
    await handleApplyingStashedChanges();
    await executeAction('create', newRequestedBranchName);
  } else {
    await handleNoCommittedChangesWhenCreatingBranch(defaultBaseBranch, newRequestedBranchName);
  }
}

// ex: creating a new branch from master while you are on A different branch
async function createNewBranchFromDefaultBranchWhileNOTChecked(defaultBaseBranch, newRequestedBranchName) {
  await handleBranchReseting(defaultBaseBranch);
  const uncommittedChanges = await uncomittedChangesExist();

  if (uncommittedChanges) {
    console.log('Uncommitted changes detected. Stashing changes before creating a new branch.');
    await runGitCommand("stash");
    await runGitCommand(`checkout ${defaultBaseBranch}`);
    await runGitCommand(`checkout -b ${newRequestedBranchName}`);
    await handleApplyingStashedChanges();
  } else {
    // Handle the scenario where there are no uncommitted changes
    // do not confirm again since you already asked when handleBranchReseting is called
    await executeAction('create', newRequestedBranchName);
  }
}

async function handleNoCommittedChangesWhenCreatingBranch(defaultBaseBranch, newRequestedBranchName) {
  // asking user to confirm reset, as an addional handling if there are uncomitted changes not detected by the first if statement
  const actions = {
    'reset-server': `Continue with reset ${defaultBaseBranch} to server and create ${newRequestedBranchName} from it. This will discard any commited and uncomitted changes.`,
    'create': `continue without reset (use only if you have changes that does not exist on the server and you want to carry them over to the new branch)`,
    'abort': `just abort the operation and do nothing.`,
  };

  const userResponse = await askUserForAction(actions);
  if (userResponse === 'reset-server') {
    await handleBranchReseting(defaultBaseBranch, false);
  } else {
    if (actions[userResponse] && userResponse !== 'abort') {
      await executeAction(userResponse, newRequestedBranchName);
    } else {
      console.log('Operation aborted or invalid option selected.');
      return;
    }
  }
}

async function handleApplyingStashedChanges() {
  console.log("Applying stashed changes...");
  await runGitCommand(`git stash apply`).catch(async (error) => {
    if (error.includes('merge conflict') || error.includes('<<<<<<<')) {
      console.error('Seems like your changes have a conflict with latest from server, no worries your changes are still stashed.');
      // TODO ASK THE USER WHAT THEY LIKE TO DO NOW? reset changes and keep them in stash, manually resolve conflicts, reset changes and remove them from stash
      const actions = {
        'manual': 'Manually resolve conflicts (I will wait for you to resolve conflicts and continue the process when you are ready)',
        'reset_keep_stash_create': 'Discard changes and keep in stash',
        'reset_remove_stash_create': 'Discard changes and remove from stash'
      };
      
        const userResponse = await askUserForAction(actions);
        if (userResponse !== 'manual') {
          await executeAction(userResponse, newRequestedBranchName);
        } else {
          const conflictActions = {
            'add_create': `I resolved and saved files, continue with the process.`,
            'abort': `just abort the operation and do nothing.`,
          };
          const userResponseForConflict = await askUserForAction(conflictActions, 'I am waiting for you to resolve conflicts');
          if (userResponseForConflict !== 'abort') {
            await executeAction(userResponseForConflict);
          }
        }
    }
  });
}

async function executeAction(action, branchName) {
  switch (action) {
    case 'stash':
      await runGitCommand('stash');
      break;
    case 'reset_keep_stash_create':
      await runGitCommand('reset --hard');
      await runGitCommandWithBranch('checkout -b ${branchName}', branchName);
      break;
    case 'reset_remove_stash_create':
      await runGitCommand('reset --hard');
      await runGitCommand('stash drop');
      await runGitCommandWithBranch('checkout -b ${branchName}', branchName);
      break;
    case 'create':
      await runGitCommandWithBranch('checkout -b ${branchName}', branchName);
      break;
    case 'add_create':
      await runGitCommand('add .');
      await runGitCommandWithBranch('checkout -b ${branchName}', branchName);
      break;
    case 'commit-squash':
      const commitSquashMessage = await askForCommitMessage();
      await stageAndCommit(commitSquashMessage);
      await squashCommitsBeforeBase();
      break;
    case 'commit':
      const commitMessage = await askForCommitMessage();
      await stageAndCommit(commitMessage);
      break;
    case 'reset-server':
      if (branchName === await getCurrentBranchName()) {
        await runGitCommandWithBranch(`reset --hard origin/${branchName}`, branchName);
      } else {
        await runGitCommand(`fetch origin ${branchName}:${branchName}`);
      }
      break;
    default:
      break;
  }
}

// Utility function to validate URLs to prevent injection attacks
function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

module.exports = { handleCreateMr, createAllMergeRequestsAndPush, commitAndCreatePR, smartBranchCreation, checkForPotentialConflicts, handlePush };