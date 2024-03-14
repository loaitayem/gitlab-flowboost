const { handleCreateMr, createAllMergeRequestsAndPush, commitAndCreatePR, smartBranchCreation, checkForPotentialConflicts, handlePush } = require('./gitCommands');

const aliases = {
    'push': () => handlePush(),
    'push-mr': (targetBranch) => handleCreateMr(targetBranch),
    'push-mr-all': () => createAllMergeRequestsAndPush(),
    'commit-push-mr-all': (commitMessage) => commitAndCreatePR(commitMessage),
    'smart-branch': (baseBranch) => smartBranchCreation(baseBranch),
    'conflict-check': (targetBranch) => checkForPotentialConflicts(targetBranch),
    // Add more aliases as needed
};

async function executeAlias(alias, ...args) {
    if (!aliases[alias]) {
      console.error(`Alias ${alias} not found.`);
      return;
    }
    try {
      await aliases[alias](...args);
    } catch (error) {
      console.error(`Error executing alias ${alias}:`, error.message);
    }
}

module.exports = { executeAlias };