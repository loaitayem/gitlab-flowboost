const { getLabelsPushOptionFromConfig, shouldDeleteBranch, getBranchSettings, allowToCreateTempBranches, getMainBranch, isDraft } = require('./configHelper');
const { runGitCommand, getCurrentBranchName, uncomittedChangesExist, checkSyncWithServer,
   deleteBranchesLocally, doesBranchExistOnServer, isUpstreamSet } = require('./gitHelper');
const { askForBranchNameAndType } = require('./inquirerHelper');
const { askUserForAction, confirmReset } = require('./inquirerHelper');
const { createAllMergeRequestsAndPush, createMergeRequestAndPush} = require('./mergeRequestsHelper');
const { createNewBranchFromDefaultBranchWhileChecked, createNewBranchFromDefaultBranchWhileNOTChecked } = require('./branchHelper');
const { readConfig } = require('./configHelper');

const config = readConfig();
const { namingConventions } = config.branchesOptions;

async function handlePush() {
  const currentBranch = await getCurrentBranchName();
  await createMergeRequestAndPush(currentBranch, false, false, false, false);
}

async function handleCreateAllMr() { 
  await createAllMergeRequestsAndPush();
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
  if (!targetBranch) {
    console.error('No target branch specified.');
    return;
  }

  let currentBranch;
  try {
    currentBranch = await getCurrentBranchName();
    const mergeBase = await runGitCommand(`merge-base "${currentBranch}" "origin/${targetBranch}"`);
    const changesInTarget = await runGitCommand(`diff --name-only "${mergeBase}" "origin/${targetBranch}"`);
    const changesInCurrent = await runGitCommand(`diff --name-only "${mergeBase}" "${currentBranch}"`);

    const targetFilesSet = new Set(changesInTarget.split('\n'));
    const conflictingFiles = changesInCurrent.split('\n').filter(fileName => targetFilesSet.has(fileName));

    if (conflictingFiles.length > 0) {
      console.log(`Potential conflicts detected between ${currentBranch} and ${targetBranch}. Please check the following files:`, conflictingFiles.join(', '));
    } else {
      console.log(`No conflicts detected between ${currentBranch} and ${targetBranch}`);
    }
  } catch (error) {
    console.error(`Error checking for potential conflicts: ${error}`);
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

module.exports = { handleCreateMr,handleCreateAllMr, commitAndCreatePR, checkForPotentialConflicts, handlePush, smartBranchCreation };