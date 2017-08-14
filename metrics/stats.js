/**
 * Created by bouza on 17/06/17.
 * The Stats calculates simple metrics from a list of prices.
 */
var Stats = module.exports = {};

Stats.calcRange = function (somePrices) {
    return Stats.calcMaxPrice(somePrices) - Stats.calcMinPrice(somePrices);
};

Stats.calcCenterPrice = function (somePrices) {
    return Stats.calcMinPrice(somePrices) + Stats.calcRange(somePrices) / 2;
};

Stats.calcMaxPrice = function (somePrices) {
    var result = -Infinity;
    for (var i = 0; i < somePrices.length; i++) {
        if (somePrices[i] > result) {
            result = somePrices[i];
        }
    }
    return result;
};

Stats.calcMinPrice = function (somePrices) {
    var result = Infinity;
    for (var i = 0; i < somePrices.length; i++) {
        if (somePrices[i] < result) {
            result = somePrices[i];
        }
    }
    return result;
};

Stats.calcAveragePrice = function (somePrices) {
    var results = 0;
    for (var i = 0; i < somePrices.length; i++) {
        results += somePrices[i];
    }
    return results / somePrices.length;
};