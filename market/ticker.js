/**
 * The market ticker retrieves event from the market and forwards them to the watchers.
 * Created by Amancio Bouza on 17/06/17.
 */
var ticker = module.exports = {};

const bittrexAPI = require('./bittrexAPI');
var poloniexAPI = require('./poloniexAPI');

var writePausePeriod = 5;   //Wait 5 seconds until next ticker request.
var tickerEvent = null;

/**##############################################
 * ### Get Info from Public Poloniex API ########
 * ##############################################
 */
ticker.startTicker = function () {
    console.log("Initializing Poloniex market ticker ...");

    setInterval(function () {
        //bittrexAPI.returnTicker(tickerEvent);
        poloniexAPI.returnTicker(tickerEvent);
    }, writePausePeriod * 1000);
    console.log("OK.")
};

ticker.setTickerEvent = function (callback) {
    tickerEvent = callback;
};