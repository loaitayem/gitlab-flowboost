const { exec } = require('child_process');
const { askForCommitMessage } = require('./inquirerHelper');

async function getCurrentBranchName() {
  const currentBranchOutput = await runGitCommand('rev-parse --abbrev-ref HEAD');
  return currentBranchOutput.trim();
}

// Executes a Git command and returns the output as a Promise.
function runGitCommand(command, returnInfo = false) {
  return new Promise((resolve, reject) => {
    exec(`git ${command}`, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Error executing git ${command}: ${stderr}, ${error.message}`));
      } else {
        if (returnInfo) {
          resolve(stderr.trim());
        } else {
          resolve(stdout.trim());
        }
      }
    });
  });
}

async function runGitCommandWithBranch(command, branchName) {
  if (!branchName) {
    throw new Error(`Error handling branch: ${branchName}`);
  }
  await runGitCommand(command.replace('${branchName}', branchName));
}

// Checks if a branch exists locally.
async function doesBranchExistLocally(branchName) {
  try {
    const result = await runGitCommand(`branch --list ${branchName}`);
    return result !== '';
  } catch (error) {
    throw new Error(`Error checking if branch exists locally: ${error}`);
  }
}

// Checks if a branch exists on the server.
async function doesBranchExistOnServer(branchName) {
  try {
    const result = await runGitCommand(`ls-remote --heads origin ${branchName}`);
    return result !== '';
  } catch (error) {
    console.error(`Error checking if branch exists on server: ${error}`);
    return false;
  }
}

// delete all branches locally
async function deleteBranchesLocally(branchNames) {
  for (const branch of branchNames) {
      try {
         await runGitCommand(`branch -d ${branch}`);
          console.log(`Branch "${branch}" deleted locally.`);
      } catch (error) {
          console.error(`Failed to delete branch "${branch}" locally:`, error.message);
      }
  };
}

async function uncomittedChangesExist() {
  return await runGitCommand('status --porcelain');
}

async function checkSyncWithServer(branchName, checkForUncommitedChanges = true) {
  try {
      if (!branchName) {
        throw new Error(`Failed to check sync with the server for branch "${branchName}"`);
      }

      await runGitCommand(`fetch origin ${branchName}`);

      if (checkForUncommitedChanges) {
        const statusOutput = await runGitCommand('status -uno -s');
        if (statusOutput.trim() !== '') {
          console.log(`There are uncommitted changes in the working directory.`);
          throw new Error(`Failed to check sync with the server for branch "${branchName}": ${error.message}`);
        }
      }

      const behindOutput = await runGitCommand('status -uno');

      if (behindOutput.includes('Your branch is behind')) {
          return false;
      } else {
          return true;
      }
  } catch (error) {
      throw new Error(`Failed to check sync with the server for branch "${branchName}": ${error}`);
  }
}

async function isUpstreamSet(branchName) {
  try {
    const ref = `refs/heads/${branchName}`;
    const upstreamRef = await runGitCommand(`for-each-ref --format='%(upstream:short)' ${ref}`);
    return Boolean(upstreamRef.trim()); // Converts the non-empty string to true, empty string to false.
  } catch (error) {
    return false; // An error indicates no upstream is set, or the branch does not exist.
  }
}

async function stageChanges() {
  try {
    await runGitCommand('add .');
  } catch (error) {
    throw new Error(`Failed to stage changes: ${error}`);
  }
}

async function commitChanges(commitMessage) {
  try {
    await runGitCommand(`commit -m "${commitMessage}"`);
  } catch (error) {
    throw new Error(`Failed to commit changes: ${error}`);
  }
}

async function stageAndCommit(commitMessage) {
  try {
    await stageChanges();
    await commitChanges(commitMessage);
  } catch (error) {
    throw new Error(`Failed to stage and commit changes: ${error}`);
  }
}

async function squashCommitsBeforeBase(baseBranch) {
  // Ensure there are no uncommitted changes in the working directory
  const uncommittedChanges = await uncomittedChangesExist();
  if (uncommittedChanges) {
    throw new Error('Please commit or stash your changes before squashing.');
  }

  // Get the current branch name
  const currentBranch = await getCurrentBranchName();

  // Ensure we are not already on the base branch
  if (currentBranch === baseBranch) {
    throw new Error(`You are already on the base branch (${baseBranch}). Squashing is not required.`);
  }

  // Find the commit where the current branch diverged from the base branch
  const mergeBase = await runGitCommand(`merge-base ${baseBranch} ${currentBranch}`);

  // Perform an interactive rebase to squash the commits
  // Note: This command may require user interaction and might be better executed directly in a shell.
  await runGitCommand(`rebase -i ${mergeBase} ${currentBranch}`);

  console.log(`Commits before the base branch (${baseBranch}) have been squashed.`);
}


async function hasRemoteUrl() {
  return new Promise((resolve, reject) => {
    exec('git remote -v', (error, stdout, stderr) => {
      if (error) {
        console.error(`Error checking for remote URLs: ${error}`);
        reject(new Error(stderr));
      } else if (stdout.trim().length === 0) {
        resolve(false); // No remote URLs found
      } else {
        resolve(true); // At least one remote URL found
      }
    });
  });
}

async function getCurrentCommitMessage() {
  return await runGitCommand('log -1 --pretty=%B');
}

async function executeAction(action, param) {
  switch (action) {
    case 'stash':
      await runGitCommand('stash');
      break;
    case 'reset_keep_stash_create':
      await runGitCommand('reset --hard');
      await runGitCommandWithBranch('checkout -b ${branchName}', param);
      break;
    case 'reset_remove_stash_create':
      await runGitCommand('reset --hard');
      await runGitCommand('stash drop');
      await runGitCommandWithBranch('checkout -b ${branchName}', param);
      break;
    case 'create':
      await runGitCommandWithBranch('checkout -b ${branchName}', param);
      break;
    case 'add_create':
      await stageChanges();
      await runGitCommandWithBranch('checkout -b ${branchName}', param);
      break;
    case 'stage':
        await stageChanges();
        break;
    case 'commit-squash':
      const commitSquashMessage = await askForCommitMessage();
      await stageAndCommit(commitSquashMessage);
      await squashCommitsBeforeBase(param);
      break;
    case 'stage-commit':
      let commitMessage = param;
      if (!param) {
        commitMessage = await askForCommitMessage();
      }
      await stageAndCommit(commitMessage);
      break;
    case 'reset-server':
      if (param === await getCurrentBranchName()) {
        await runGitCommandWithBranch(`reset --hard origin/${param}`, param);
      } else {
        await runGitCommand(`fetch origin ${param}:${param}`);
      }
      break;
    default:
      break;
  }
}

module.exports = {
  runGitCommand,
  runGitCommandWithBranch,
  doesBranchExistLocally,
  deleteBranchesLocally,
  checkSyncWithServer,
  getCurrentBranchName,
  uncomittedChangesExist,
  doesBranchExistOnServer,
  isUpstreamSet,
  stageAndCommit,
  squashCommitsBeforeBase,
  hasRemoteUrl,
  executeAction,
  getCurrentCommitMessage
};