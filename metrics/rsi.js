/**
 * Created by bouza on 17/06/17.
 * The MACD calcualtes the MACD and MACD signal from the corresponding EMA.
 */
var EMA = require('./ema');

var RSI = module.exports = {};

RSI.calcRelativeStrength = function (aPriceHistory, aPeriod) {
    if (aPriceHistory.length < aPeriod) {
        return;
    }

    var up = [];
    var down = [];

    for (var i = 1; i < aPriceHistory.length; i++) {
        var prevPrice = aPriceHistory[i - 1];
        var lastPrice = aPriceHistory[i];
        if (prevPrice < lastPrice) {
            up.push(lastPrice - prevPrice);
            down.push(0);
        } else if (prevPrice > lastPrice) {
            up.push(0);
            down.push(prevPrice - lastPrice);
        } else {
            up.push(0);
            down.push(0);
        }
    }

    var upMMA = EMA.calcExponentialMovingAverage(up, up.length, 1 / aPeriod);
    var downMMA = EMA.calcExponentialMovingAverage(down, down.length, 1 / aPeriod);

    return upMMA / downMMA;
};

RSI.calcRelativeStrengthIndicator = function (aPriceHistory, aPeriod) {
    if (aPriceHistory.length < aPeriod) {
        return;
    }

    //var rs = RSI.calcRelativeStrength(aPriceHistory.slice(aPriceHistory.length - 1 - aPeriod), aPeriod);
    var rs = RSI.calcRelativeStrength(selectClosePrices(aPriceHistory), aPeriod / 12);
    return 100 - 100 / (1 + rs);
};

function selectClosePrices(aPriceHistory) {
    var results = [];
    for (var i = 0; i < aPriceHistory.length; i += 12) {
        results.push(aPriceHistory[i]);
    }
    return results;
}