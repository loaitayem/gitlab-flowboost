#!/usr/bin/env node

const { executeAlias } = require('./aliases');
const { hasRemoteUrl } = require('./gitHelper');

// Process command-line arguments
const [, , alias, ...args] = process.argv;

(async () => {
    // Check for remote URL at the start
    const remoteExists = await hasRemoteUrl();
    if (!remoteExists) {
        console.log('No remote URL configured. Please add a remote repository to use this tool.');
        console.log('You can add a remote url using: git remote add origin <url-to-repo>');
        process.exit(1); // Exit if remote URL is necessary for further operations
    }

    // Proceed with the rest of your CLI logic if a remote URL exists
    if (!alias) {
        console.log('Please specify an alias to execute.');
        process.exit(1);
    }

    await executeAlias(alias, ...args);
})();