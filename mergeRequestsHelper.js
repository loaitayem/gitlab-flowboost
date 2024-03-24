const { getLabelsPushOptionFromConfig, shouldDeleteBranch, getBranchSettings, allowToCreateTempBranches, getMainBranch, isDraft } = require('./configHelper');
const { runGitCommand, getCurrentBranchName, uncomittedChangesExist, checkSyncWithServer,
   deleteBranchesLocally, doesBranchExistOnServer, isUpstreamSet, executeAction } = require('./gitHelper');
const { askUserForAction } = require('./inquirerHelper');
const { findLinksAndOpenThem, handleBranchReseting } = require('./commonHelper');

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
        const currentCommitMessage = await runGitCommand('log -1 --pretty=%B');
        await runGitCommand(`commit --amend -m "${currentCommitMessage.trim()} - ${includeOptions ?? '- triggered PR creation'}"`);
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
      await deleteBranchesLocally(createdTempBranches);
    }
        }
    } catch (error) { 
      console.error(error);
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

  module.exports = { createAllMergeRequestsAndPush, createMergeRequestAndPush };
