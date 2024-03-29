const { getFeature, getBranchSettings } = require('./configHelper');
const { sendMessage, sendMergeRequestNotification } = require('./slackHelper');

runTests();
let errors = [];

async function runTests() { 
    // Implement your test mode-specific logic here
    await getFeatureTest();
    await getBranchSettingsTest();

    if (errors.length > 0) {
        console.log(`\x1b[31m${errors.join('\n')}\x1b[0m`);
      } else {
        console.log('\x1b[32mAll tests passed\x1b[0m');
    }
}

async function getBranchSettingsTest() {
    const isDraftMaster = getBranchSettings('master').isDraftPR;
    const isDraftDev = getBranchSettings('env/dev').isDraftPR;
    if (isDraftDev) {
        errors.push(`Error: Expected "false" but got "${isDraftDev}" in isDraft env/dev`);
    }

    if (!isDraftMaster) {
        errors.push(`Error: Expected "false" but got "${isDraftMaster}" in isDraft Master`);
    }
}

async function getFeatureTest() {
    const mainBranch = await getFeature("mergeRequestOptions", "mainBranch");
    const shouldDelete = getFeature('mergeRequestOptions', 'setToDeleteBranchAfterMainMerge');
    const allowTempBranches = getFeature('mergeRequestOptions', 'allowToCreateTempBranches');


    if (mainBranch !== 'master') {
        errors.push(`Error: Expected "master" but got "${mainBranch}" in mainBranch`);
    }

    if (shouldDelete) {
        errors.push(`Error: Expected "true" but got "${shouldDelete}" in setToDeleteBranchAfterMainMerge`);
    }

    if (!allowTempBranches) {
        errors.push(`Error: Expected "true" but got "${allowTempBranches}" in allowToCreateTempBranches`);
    }
}
