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

  async function findLinksAndOpenThem(pushCommandResult) {
    return new Promise((resolve, reject) => {
      try {
        const urlMatch = pushCommandResult.match(/(http[s]?:\/\/[\S]+)/); // Regex to find URLs in the output
        if (urlMatch) {
          const mergeRequestUrl = urlMatch[0];
          if (isValidUrl(mergeRequestUrl)) {
            console.log('Opening merge request URL:', mergeRequestUrl);
            // Platform-specific commands to open the URL in the default browser
            switch (process.platform) {
              case 'darwin': // macOS
                exec(`open ${mergeRequestUrl}`);
                break;
              case 'win32': // Windows
                exec(`start ${mergeRequestUrl}`);
                break;
              default: // Linux and others
                exec(`xdg-open ${mergeRequestUrl}`);
                break;
            }
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

  module.exports = { handleBranchReseting, findLinksAndOpenThem };