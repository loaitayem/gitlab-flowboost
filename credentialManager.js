const { loadInquirer } = require('./inquirerWrapper');
const { exec } = require('child_process');

async function askForCredentialsAndStore(serviceName) {
    const inquirer = await loadInquirer();

    // Prompt for username and password
    const questions = [
        {
            type: 'input',
            name: 'username',
            message: 'Enter your username:',
            validate: input => !!input || 'Username cannot be empty.',
        },
        {
            type: 'password',
            name: 'password',
            message: 'Enter your password:',
            mask: '*',
            validate: input => !!input || 'Password cannot be empty.',
        }
    ];

    const { username, password } = await inquirer.prompt(questions);
    storeCredentialsWindows(username, password, serviceName);
}

function storeCredentialsWindows(username, password, service) {
    const serviceName = `flow-boost:${service}`;
    exec(`cmdkey /generic:${serviceName} /user:${username} /pass:${password}`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Failed to store credentials: ${stderr}`);
            return;
        }
    });
}

function getCredentials(service) {
    const credentialManager = require('./build/Release/credentialManager.node');

    const credentials = credentialManager.getPassword(service);
    if (credentials) {
        return {username: credentials.username.toString(), password: credentials.password.toString()};
    } else {
        console.error('Failed to retrieve credentials for:', service);
        return undefined;
    }
}

async function retrieveCredentials(service, ask = true) {
    const serviceName = `flow-boost:${service}`;
    const credentials = getCredentials(serviceName);
    if (!credentials) {
        if (ask) {
          await askForCredentialsAndStore(serviceName);
          return getCredentials(serviceName);
        }
    }

    return credentials;
}

module.exports = { retrieveCredentials, storeCredentialsWindows };