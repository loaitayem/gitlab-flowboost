const { runGitCommand, uncomittedChangesExist, executeAction } = require('./gitHelper');
const { askUserForAction } = require('./inquirerHelper');
const { handleBranchReseting } = require('./commonHelper');

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
      await executeAction("stash");
      await runGitCommand(`checkout ${defaultBaseBranch}`);
      await runGitCommand(`checkout -b ${newRequestedBranchName}`);
      await handleApplyingStashedChanges();
    } else {
      // Handle the scenario where there are no uncommitted changes
      // do not confirm again since you already asked when handleBranchReseting is called
      await executeAction('create', newRequestedBranchName);
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


  module.exports = { createNewBranchFromDefaultBranchWhileChecked, createNewBranchFromDefaultBranchWhileNOTChecked };