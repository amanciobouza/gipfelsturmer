/**
 * The market ticker retrieves event from the market and forwards them to the watchers.
 * Created by Amancio Bouza on 17/06/17.
 */
var ticker = module.exports = {};

const autobahn = require('autobahn');

var webServiceURI = "wss://api.poloniex.com";
var tickerEvent = null;

/**
 * Push API
 * @type {connection.Connection}
 */
ticker.connection = new autobahn.Connection({
    url: webServiceURI,
    realm: "realm1"
});
ticker.connection.onopen = function (session) {
    console.log('Connection to market ticker is established.');
    session.subscribe('ticker', tickerEvent);
};
ticker.connection.onclose = function (session, details) {
    console.log("Connection to market ticker is closed: " + session + ". Retry #" + details.retry_count + " in " + Math.round(details.retry_delay) + "sec.");
};

ticker.setTickerEvent = function (callback) {
    tickerEvent = callback;
};