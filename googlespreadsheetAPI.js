/**
 * Google Spreadsheet API
 * Created by bouza on 24/06/17.
 */
var googleSpreadsheetAPI = module.exports = {};

var fs = require('fs');
var readLine = require('readline');
var googleAPIs = require('googleapis');
var googleAuth = require('google-auth-library');
var _ = require('lodash');
var sheets = googleAPIs.sheets('v4');

var configurations = require('./config.js');

var auth = null;

var tickerLimit = 1442; //2880; //+2
var tabRange = '!A2:AF';
var rowCounter = 0;
var emptyRow = [];

var traders = [];

//Write pause period in Seconds
var writePausePeriod = 5;

// If modifying these scopes, devare your previously saved credentials at ~/.credentials/sheets.googleapis.com-nodejs-quickstart.json
var SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH ||
    process.env.USERPROFILE) + '/.credentials/';
var TOKEN_PATH = TOKEN_DIR + 'sheets.googleapis.com-nodejs-quickstart.json';

function wipe(auth, aSpreadsheetId, aTab) {
    var range = tabRange + (tickerLimit + 1);
    var data = [];
    fill(data, tickerLimit + 1);

    sheets.spreadsheets.values.update({
        auth: auth,
        spreadsheetId: aSpreadsheetId,
        range: aTab + range,
        valueInputOption: 'USER_ENTERED',
        resource: {"values": data}
    }, function (err, response) {
        if (err) {
            console.log('Could not wipe Google spreadsheet: ' + err);
        }
    });
}

function swipeWindow(auth, someData, aSpreadsheetId, aTab) {
    var range = createTabRange(rowCounter);
    sheets.spreadsheets.values.update({
        auth: auth,
        spreadsheetId: aSpreadsheetId,
        range: aTab + range,
        valueInputOption: 'USER_ENTERED',
        resource: {"values": [someData]}
    }, function (err, response) {
        if (err) {
            if (err.code != 502) {
                console.log('The API returned an error: ' + err);
            }
        }
    });
}

function nextCounter() {
    rowCounter += 1;
    rowCounter %= tickerLimit + 1;
    return rowCounter;
}

function createTabRange(aRowCounter) {
    var row = 2 + aRowCounter;
    var result = "!A" + row + ":AF" + row;

    return result;
}


function slideWindow(auth, someData, aSpreadsheetId, aTab) {
    var range = tabRange;// + (tickerLimit + 1);
    sheets.spreadsheets.values.get({
        auth: auth,
        spreadsheetId: aSpreadsheetId,
        range: aTab + range
    }, function (err, response) {
        if (err) {
            console.log('The API returned an error: ' + err);
        }
        if (response && (_.isNil(response.values) || response.values.length < tickerLimit)) {
            sheets.spreadsheets.values.append({
                auth: auth,
                spreadsheetId: aSpreadsheetId,
                range: aTab + range,
                valueInputOption: 'USER_ENTERED',
                resource: {"values": [someData]}
            }, function (err, response) {
                if (err) {
                    console.log('The API returned an error: ' + err);
                }
            });
        } else if (response && !_.isNil(response.values)) {
            var data = response.values;
            data.push(someData);
            var dataRangeToKeep = Math.round(tickerLimit);
            data.splice(0, dataRangeToKeep);
            fill(data, tickerLimit - dataRangeToKeep);
            sheets.spreadsheets.values.update({
                auth: auth,
                spreadsheetId: aSpreadsheetId,
                range: aTab + range,
                valueInputOption: 'USER_ENTERED',
                resource: {"values": data}
            }, function (err, response) {
                if (err) {
                    console.log('The API returned an error: ' + err);
                }
            });
        }
    });


}

function fill(someData, amount) {
    for (var i = 0; i < amount; i++) {
        someData.push(emptyRow);
    }
}

function writeToTab(auth, someData, aSpreadsheetId, aTab) {
    sheets.spreadsheets.values.append({
        auth: auth,
        spreadsheetId: aSpreadsheetId,
        range: aTab + '!A2:A',
        valueInputOption: 'USER_ENTERED',
        resource: {"values": [someData]}
    }, function (err, response) {
        if (err) {
            console.log('The API returned an error: ' + err);
        }
    });
}

function write(auth, someData, aSpreadsheetId, aTab) {
    swipeWindow(auth, someData, aSpreadsheetId, aTab);
}

googleSpreadsheetAPI.write = function (someData, aSpreadsheetId, aTab) {
    if (_.isNil(auth)) {
        fs.readFile('client_secret.json', function processClientSecrets(err, content) {
            if (err) {
                console.log('Error loading client secret file: ' + err);
                return;
            }
            // Authorize a client with the loaded credentials, then call the Google Sheets API.
            authorize(JSON.parse(content), someData, aSpreadsheetId, aTab, write);
        });
    } else {
        write(auth, someData, aSpreadsheetId, aTab);
    }
};

googleSpreadsheetAPI.writeTransaction = function (someData, aSpreadsheetId) {
    if (null === auth) {
        fs.readFile('client_secret.json', function processClientSecrets(err, content) {
            if (err) {
                console.log('Error loading client secret file: ' + err);
                return;
            }
            // Authorize a client with the loaded credentials, then call the Google Sheets API.
            authorize(JSON.parse(content), toTransactionArray(someData, true), aSpreadsheetId, googleSpreadsheetAPI.writeTransaction);
        });
    } else {
        writeToTab(auth, toTransactionArray(someData, true), aSpreadsheetId, "Transactions");
    }
};

googleSpreadsheetAPI.bufferTicker = function (someData, aTraderId) {
    for (var i = 0; i < traders.length; i++) {
        if (traders[i].id === aTraderId) {
            traders[i].bufferedTicker = toArray(someData, false);
            traders[i].rowCounter = traders[i].rowCounter++;
        }
    }
};

googleSpreadsheetAPI.initialize = function () {
    setInterval(function () {
        if (new Date().getSeconds() % writePausePeriod === 0) {
            nextCounter();
            for (var i = 0; i < traders.length; i++) {
                var trader = traders [i];
                if (!configurations.isWriteTickerActive(trader.id)) {
                    trader.bufferedTicker = null;
                }
                if (!_.isNil(trader.bufferedTicker)) {
                    if (rowCounter >= tickerLimit) {
                        wipe(auth, configurations.getSpreadsheetId(trader.id), "Ticker");
                    }
                    trader.bufferedTicker[0] = createDateTime();
                    googleSpreadsheetAPI.write(trader.bufferedTicker, configurations.getSpreadsheetId(trader.id), "Ticker");
                }
            }
        }
    }, 1000);

    for (var i = 0; i < 32; i++) {
        emptyRow.push('');
    }
};

function createDateTime() {
    return new Date().getUTCMonth() + 1 + '/' + new Date().getUTCDate() + '/' + new Date().getFullYear() + " " + new Date().getUTCHours() + ":" + new Date().getMinutes() + ":" + new Date().getUTCSeconds();
}

googleSpreadsheetAPI.initializeTrader = function (aTraderId) {
    var trader = findTrader(aTraderId);
    var spreadsheetId = configurations.getSpreadsheetId(aTraderId);
    if (_.isNil(trader)) {
        trader = createTrader(aTraderId, spreadsheetId);
        traders.push(trader);
    } else {
        trader.spreadsheetId = spreadsheetId;
    }
};

function findTrader(aTraderId) {
    for (var i = 0; i < traders.length; i++) {
        if (traders[i].id === aTraderId) {
            return traders[i];
        }
    }
    return null;
}

function createTrader(aTraderId, aSpreadsheetId) {
    var result = {};
    result.id = aTraderId;
    result.spreadsheetId = aSpreadsheetId;
    result.bufferedTicker = null;
    result.rowCounter = 0;
    return result;
}

function toArray(aTicker, withStats) {
    var result = [];

    result.push(aTicker.datetime);
    result.push(aTicker.currencyPair);
    result.push(aTicker.lastPrice);
    result.push(aTicker.lowestAsk);
    result.push(aTicker.highestBid);
    result.push(aTicker.percentChange);
    result.push(aTicker.baseVolume);
    result.push(aTicker.quoteVolume);
    result.push(aTicker.highest24hrPrice);
    result.push(aTicker.lowest24hrPrice);
    result.push(aTicker['fib_0.0']);
    result.push(aTicker['fib_23.8']);
    result.push(aTicker['fib_38.0']);
    result.push(aTicker['fib_50.0']);
    result.push(aTicker['fib_61.8']);
    result.push(aTicker['fib_100.0']);
    result.push(aTicker.sma);
    result.push(aTicker.emaA);
    result.push(aTicker.emaB);
    result.push(aTicker.macd);
    result.push(aTicker.macdSignal);
    result.push(aTicker.highNoiseFilter);
    result.push(aTicker.lowNoiseFilter);
    result.push(aTicker.rsi);
    result.push(aTicker.rsiOversold);
    result.push(aTicker.rsiOverbought);
    result.push(aTicker.buyRate);
    result.push(aTicker.sellRate);
    result.push(aTicker.buyAmount);
    result.push(aTicker.sellAmount);
    result.push(aTicker.buyTotal);
    result.push(aTicker.sellTotal);
    if (withStats) {
        result.push("=INDIRECT(\"R[-1]C[0]\",false)+INDIRECT(\"R[0]C[-2]\",false)");
        result.push("=INDIRECT(\"R[-1]C[0]\",false)+INDIRECT(\"R[0]C[-2]\",false)");
        result.push("=INDIRECT(\"R[0]C[-1]\",false)-INDIRECT(\"R[0]C[-2]\",false)");
    }

    return result;
}

function toTransactionArray(aTicker) {
    var result = [];
    result.push(aTicker.datetime);
    result.push(aTicker.currencyPair);
    result.push(aTicker.lastPrice);
    result.push(aTicker.buyRate);
    result.push(aTicker.sellRate);
    result.push(aTicker.buyAmount);
    result.push(aTicker.sellAmount);
    result.push(aTicker.buyTotal);
    result.push(aTicker.sellTotal);
    result.push("=INDIRECT(\"R[-1]C[0]\",false)+INDIRECT(\"R[0]C[-2]\",false)");
    result.push("=INDIRECT(\"R[-1]C[0]\",false)+INDIRECT(\"R[0]C[-2]\",false)");
    result.push("=INDIRECT(\"R[0]C[-1]\",false)-INDIRECT(\"R[0]C[-2]\",false)");

    return result;
}

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param someData
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, someData, aSpreadsheetId, aTab, callback) {
    //initialize
    var clientSecret = credentials.installed.client_secret;
    var clientId = credentials.installed.client_id;
    var redirectUrl = credentials.installed.redirect_uris[0];

    //authorize
    auth = new googleAuth();
    var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, function (err, token) {
        if (err) {
            getNewToken(oauth2Client, someData, callback);
        } else {
            oauth2Client.credentials = JSON.parse(token);
            auth = oauth2Client;
            callback(auth, someData, aSpreadsheetId, aTab);
        }
    });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {googleAPIs.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param someData
 *     client.
 */
function getNewToken(oauth2Client, someData, callback) {
    var authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES
    });
    console.log('Authorize this app by visiting this url: ', authUrl);
    var rl = readLine.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    rl.question('Enter the code from that page here: ', function (code) {
        rl.close();
        oauth2Client.getToken(code, function (err, token) {
            if (err) {
                console.log('Error while trying to retrieve access token', err);
                return;
            }
            oauth2Client.credentials = token;
            storeToken(token);
            callback(oauth2Client, someData);
        });
    });
}

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
function storeToken(token) {
    try {
        fs.mkdirSync(TOKEN_DIR);
    } catch (err) {
        if (err.code !== 'EEXIST') {
            throw err;
        }
    }
    fs.writeFile(TOKEN_PATH, JSON.stringify(token));
    console.log('Token stored to ' + TOKEN_PATH);
}

