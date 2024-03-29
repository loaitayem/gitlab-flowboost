const { readConfig } = require('./configHelper');

const { loadInquirer } = require('./inquirerWrapper');
const config = readConfig();
const { namingConventions } = config.branchesOptions;

async function askForBranchNameAndType() {
  const branchType = await askForBranchType();
  const newBranchName = await askforNewBranchName(branchType);
  if (newBranchName && branchType) {
    return { branchType, newBranchName };
  } return undefined;
}

async function askForCommitMessage() {
  const inquirer = await loadInquirer(); // Ensure inquirer is loaded

  const questions = [
    {
      type: 'input',
      name: 'commitMessage',
      message: 'Please enter your commit message:',
      validate: function(input) {
        // Optionally add validation logic here
        if (input.trim() === '') {
          return 'Commit message cannot be empty.';
        }
        return true;
      }
    }
  ];

  const answers = await inquirer.prompt(questions);
  return answers.commitMessage; // Return the commit message entered by the user
}

async function askforNewBranchName(branchType) {
  const inquirer = await loadInquirer();

  const { template, placeHoldersValidation, finalValidationRegex } = namingConventions[branchType];
  const placeholders = template.match(/\$\{([^}]+)\}/g) || [];

  let prompts = placeholders.map(placeholder => {
    const name = placeholder.slice(2, -1); // Extract placeholder name
    const placeholderRegex = placeHoldersValidation ? placeHoldersValidation[name] : null;
    return {
      type: 'input',
      name,
      message: `Enter the ${name} for your branch:`,
      validate: input => {
        if (!placeholderRegex) return true; // Skip validation if no regex is defined for this placeholder
        const regex = new RegExp(placeholderRegex);
        return regex.test(input) ? true : `The ${name} does not meet the required format. Please try again.`;
      }
    };
  });

  const responses = await inquirer.prompt(prompts);
  
  // Directly construct newBranchName using responses
  let newBranchName = template;
  for (const placeholder of placeholders) {
    const name = placeholder.slice(2, -1);
    // Replace each placeholder with its corresponding response
    newBranchName = newBranchName.replace(placeholder, responses[name]);
  }

    // Optional final validation with the complete branch name
    if (finalValidationRegex) {
        const finalPattern = new RegExp(finalValidationRegex);
        if (!finalPattern.test(newBranchName)) {
          console.error(`The branch name "${newBranchName}" does not meet the required final format.`);
          return undefined; // Exit if the final branch name is not valid
        }
    }

    return newBranchName;
}

async function askForBranchType() {
    const { namingConventions } = config.branchesOptions;
    const inquirer = await loadInquirer();
  
    const { branchType } = await inquirer.prompt([
      {
        type: 'list',
        name: 'branchType',
        message: 'Select the type of branch you want to create:',
        choices: Object.keys(namingConventions),
      },
    ]);
    return branchType;
}

async function confirm(message) {
  const confirmChoices = {
    'yes': `yes`,
    'no': `no`,
  };

  return await askUserForAction(confirmChoices, message) === 'yes' ? true : false;
}

async function confirmReset(branchNameToReset) {
  const resetActions = {
    'yes': `confirm reset ${branchNameToReset} to server.`,
    'no': `just abort the operation and do nothing.`,
  };

  return await askUserForAction(resetActions, 'Please confirm:') === 'yes' ? true : false;
}

async function askUserForAction(options, message = 'Select an action:') {
    const inquirer = await loadInquirer();
    let choices = [];
    if (Array.isArray(options)) { 
      choices = options;
    } else {
      choices =  Object.entries(options).map(([key, action]) => ({
        name: action,
        value: key
      }));
    }
    
    // Define the question for the user
    const question = [
      {
        type: 'list',
        name: 'selectedActionKey',
        message: message,
        choices: choices,
      }
    ];
  
    // Prompt the user with the question
    const answers = await inquirer.prompt(question);
    
    // Return the key corresponding to the selected action
    return answers.selectedActionKey;
  }

module.exports = { askForBranchNameAndType, askUserForAction, confirmReset, askForCommitMessage, confirm };