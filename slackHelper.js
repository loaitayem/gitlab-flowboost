const { retrieveCredentials, storeCredentialsWindows } = require('./credentialManager');
const { open } = require('./commonHelper');
const {confirm, askUserForAction} = require('./inquirerHelper');
const {getBranchNameById} = require('./configHelper');
const { loadInquirer } = require('./inquirerWrapper');
const express = require('express');
const https = require('https');
const fs = require('fs');

const { getSlackSettings } = require('./configHelper');
const settings = getSlackSettings();
const axios = getAxios(settings.vpnCertPath);

function storeCred(credentials) {
  storeCredentialsWindows(credentials.clientId, credentials.clientSecret, 'slack');
}

function storeToken(token) { 
  storeCredentialsWindows('slack-token', token, 'slack-token');
}

async function retrieveCred() {
    const credentials = await retrieveCredentials('slack', false);
    if (!credentials) {
        return undefined;
    }
    return { clientId: credentials.username, clientSecret: credentials.password };
}

async function retrieveToken() {
    const token = await retrieveCredentials('slack-token', false);
    if (!token) {
        return undefined;
    }
    return token.password;
}

async function promptForCredentials() {
    const inquirer = await loadInquirer();
    return inquirer.prompt([
        {
            name: 'clientId',
            type: 'input',
            message: 'Enter your Slack Client ID:',
        },
        {
            name: 'clientSecret',
            type: 'password',
            message: 'Enter your Slack Client Secret:',
            mask: '*',
        },
    ]);
}


async function initiateOAuth(clientId, clientSecret) {
    if (!settings?.port) { 
        throw new Error('Port is not defined in the configuration file');
    }

    if (!settings?.KeyPath || !settings?.CaPath) {
        throw new Error('SSL certificate paths are not defined in the configuration file');
    }

    const app = express();

    // Read the SSL certificate and private key
    const privateKey = fs.readFileSync(settings.KeyPath, 'utf8');
    const certificate = fs.readFileSync(settings.CaPath, 'utf8');
    
    const credentials = { key: privateKey, cert: certificate };
    const httpsServer = https.createServer(credentials, app);

    const port = settings.port;
    let server = null;

    server = httpsServer.listen(port, () => {
        const authUrl = `https://slack.com/oauth/v2/authorize?client_id=${encodeURIComponent(clientId)}&user_scope=chat:write&redirect_uri=${encodeURIComponent('https://localhost:' + port + '/oauth/callback')}`;
        open(authUrl);
    });

    return new Promise((resolve, reject) => {
        app.get('/oauth/callback', async (req, res) => {
            const { code } = req.query;

            try {
                const response = await axios.post('https://slack.com/api/oauth.v2.access', null, {
                    params: {
                        code,
                        client_id: clientId,
                        client_secret: clientSecret,
                        redirect_uri: `https://localhost:${port}/oauth/callback`,
                    },
                });

                server.close();
                resolve(response.data.authed_user.access_token);
                res.send('Authentication successful. You can close this tab.');
            } catch (error) {
                server.close();
                reject(error);
                res.status(500).send('Authentication failed.');
            }
        });
    });
}

function getAxios(vpnCertPath) {
    if (vpnCertPath) {
      const ca = fs.readFileSync(vpnCertPath);
      const agent = new https.Agent({
        ca: ca
      });

      return require('axios').create({ httpsAgent: agent });
    }

    return require('axios');
}

async function sendMessage(channel, message) {
    if (!channel || !message) { 
        throw new Error('Channel and message are required');
    }

    let creds = await retrieveCred();
    let token = await retrieveToken();
    let answers;
    if (!creds) {
      answers = await promptForCredentials();
      creds = { clientId: answers.clientId, clientSecret: answers.clientSecret };
      storeCred(creds);
    }

    if (!token) {
        try {
          token = await initiateOAuth(creds.clientId, creds.clientSecret);
          storeToken(token);
        } catch (error) { 
            console.error('Failed to authenticate:', error);
            return;
        }
    }

    if (message.includes('@here')) {
        message = message.replace('@here', '<!here>');
    }

    try {
        const response = await axios.post('https://slack.com/api/chat.postMessage', {
            channel,
            text: message,
        }, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.data.ok) {
            if (response.data.error === 'token_revoked' || response.data.error === 'invalid_auth') {
                // Token is invalid or expired
                console.log('Token has expired. Initiating re-authentication...');
                await initiateOAuth(creds.clientId, creds.clientSecret);
                sendMessage(channel, message); // Retry sending the message after re-authentication
            } else {
                // Handle other errors
                throw new Error(`Failed to send Slack message: ${response.data.error}`);
            }
        }

        console.log('Message sent successfully');
    } catch (error) {
        console.error('Failed to send message:', error);
    }
}

async function askForChannel() {
    const channels = settings.channels || [];
  
    // Check if there are any channels configured
    if (channels.length === 0) {
      console.error('No channels are configured in the default-config.json.');
      return undefined;
    }

    return await askUserForAction(settings.channels, 'Select a Slack channel:');
  }



async function sendMergeRequestNotification(message, branchToUrlMap) {
    const shouldSend = await confirm('Do you want to send a Slack notification for the merge request?');
    if (!shouldSend) { return; }

    const channel = await askForChannel();
    console.log(channel);
    const templateMessage = getPRNotificationMessage(message, branchToUrlMap);
    await sendMessage(channel, templateMessage);
  }

function getPRNotificationMessage(commitText, branchToUrlMap) {
    let message = settings.messageTemplates.mergeRequestNotification.template;
    message = message.replace("{commitText}", commitText);
  
    for (const [key, templateConfig] of Object.entries(settings.messageTemplates.mergeRequestNotification.templates)) {
      const branchName = getBranchNameById(templateConfig.branchId);
      const branchUrl = branchToUrlMap[branchName];
      if (branchUrl) {
        const sectionMessage = templateConfig.template.replace("{PR_URL}", branchUrl);
        message = message.replace(`{${key}}`, sectionMessage);
      } else {
        message = message.replace(`{${key}}`, ""); // Remove placeholder if no URL is available
      }
    }
  
    return message;
}

module.exports = { sendMessage, askForChannel, sendMergeRequestNotification };