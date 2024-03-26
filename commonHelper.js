const { exec } = require('child_process');
const { confirmReset } = require('./inquirerHelper');
const { executeAction } = require('./gitHelper');

async function handleBranchReseting(defaultBaseBranch, shouldConfirm = true) {
    if (shouldConfirm) {
      const confirmResetResult = await confirmReset(defaultBaseBranch);
      if (confirmResetResult)  {
        await executeAction('reset-server', defaultBaseBranch); 
      }
    } else {
      await executeAction('reset-server', defaultBaseBranch);
    }
  }

  async function open(url) {
    // Platform-specific commands to open the URL in the default browser
    console.log('Opening URL:', url);
    switch (process.platform) {
        case 'darwin': // macOS
          exec(`open "${url}"`);
          break;
        case 'win32': // Windows
          exec(`start "" "${url}"`);
          break;
        default: // Linux and others
          exec(`xdg-open "${url}"`);
          break;
      }
  }

  async function findLinksAndOpenThem(pushCommandResult) {
    return new Promise((resolve, reject) => {
      try {
        const urlMatch = pushCommandResult.match(/(http[s]?:\/\/[\S]+)/); // Regex to find URLs in the output
        if (urlMatch) {
          const mergeRequestUrl = urlMatch[0];
          if (isValidUrl(mergeRequestUrl)) {
            console.log('Opening merge request URL:', mergeRequestUrl);
            open(mergeRequestUrl);
          }
        }
        resolve();
    } catch (error) {
        reject(error);
        throw new Error(`Error finding and opening links: ${error.message}`);
      }
    });
  }

  // Utility function to validate URLs to prevent injection attacks
function isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }

  module.exports = { handleBranchReseting, findLinksAndOpenThem, open };