/**
 * Created by bouza on 17/06/17.
 * The MACD calcualtes the MACD and MACD signal from the corresponding EMA.
 */
var EMA = require('./ema');

var MACD = module.exports = {};

MACD.calcMACD = function (emaA, emaB) {
    return emaA - emaB;
};

MACD.calcMACDSignal = function (someMACD, aPeriod, aCoefficient) {
    return ema.calcExponentialMovingAverage(someMACD, aPeriod, aCoefficient);
};