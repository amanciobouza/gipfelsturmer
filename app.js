/**
 * Crypt Trader.
 * Created by bouza on 17/06/17.
 */
var trader = require('./mastertrader');
var googleAPI = require('./googlespreadsheetAPI');

googleAPI.initialize();
trader.initialize();




