/**
 * Created by bouza on 17/06/17.
 * The EMA calculates the exponential moving average of a price list, which is time ordered.
 * It extends the ticker info with calculated metrics previous to providing the info to the trader.
 */
var EMA = module.exports = {};

EMA.calcMovingAverage = function (somePrices, aPeriod) {
    return EMA.calcExponentialMovingAverage(somePrices, aPeriod, 0);
};

EMA.calcExponentialMovingAverage = function (somePrices, aPeriod, aCoefficient) {
    if (aPeriod > somePrices.length) {
        return;
    }

    var sumA = 0;
    var result = 0;
    for (var i = 0; i < aPeriod; i++) {
        var lastPrice = somePrices[somePrices.length - 1 - i];
        var multiplier = Math.pow(1 - aCoefficient, i);
        result += lastPrice * multiplier;
        sumA += multiplier;
    }
    return +result / sumA;
};

EMA.calcMMA = function (aPriceHistory, aPeriod) {
    var sum = 0;

    for (var i = 1; i < aPriceHistory.length; i++) {
        sum += aPriceHistory[i];
    }

    return sum / aPeriod;
};