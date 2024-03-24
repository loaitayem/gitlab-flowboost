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
            validate: input => !!input || 'Password cannot be empty.',
        }
    ];

    const { username, password } = await inquirer.prompt(questions);
    storeCredentialsWindows(username, password, serviceName);
}

function storeCredentialsWindows(username, password, serviceName) {
    exec(`cmdkey /generic:${serviceName} /user:${username} /pass:${password}`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Failed to store credentials: ${stderr}`);
            return;
        }
    });
}

let reissue = false;
async function retrieveCrediantalsOnWindows(serviceName) {
    if (process.platform !== 'win32') {
        // TODO support feature on other platforms
        console.error('This feature is only available on Windows.');
        return;
    }

    const credentialManager = require('./build/Release/credentialManager.node');

    const credentials = credentialManager.getPassword(serviceName);
    if (credentials) {
        return { userName: credentials.username, pass: credentials.password };
    } else {
        await askForCredentialsAndStore(serviceName);
        if (!reissue) {
          reissue = true;
          return retrieveCrediantalsOnWindows(serviceName);
        } else {
            console.error('Failed to retrieve credentials for');
        }
    }
}

module.exports = { retrieveCrediantalsOnWindows };