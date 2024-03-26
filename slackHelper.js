const { retrieveCredentials, storeCredentialsWindows } = require('./credentialManager');
const { open } = require('./commonHelper');
const axios = require('axios');
const { loadInquirer } = require('./inquirerWrapper');
const express = require('express');
const https = require('https');
const fs = require('fs');

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
    const app = express();

    // Read the SSL certificate and private key
    const privateKey = fs.readFileSync('./key.pem', 'utf8');
    const certificate = fs.readFileSync('./cert.pem', 'utf8');
    
    const credentials = { key: privateKey, cert: certificate };
    const httpsServer = https.createServer(credentials, app);

    const port = 3000; // Choose an available port
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
                console.log(response);
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

async function sendMessage(channel, message) {
    let creds = await retrieveCred();
    let token = await retrieveToken();
    let answers;
    if (!creds) {
      answers = await promptForCredentials();
      creds = { clientId: answers.clientId, clientSecret: answers.clientSecret };
      storeCred(creds);
    }

    if (!token) {
        token = await initiateOAuth(creds.clientId, creds.clientSecret);
        storeToken(token);
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
            console.log(response.data.error);
        }

        console.log(token);
        console.log('Message sent successfully');
    } catch (error) {
        console.error('Failed to send message:', error);
    }
}

module.exports = { sendMessage };