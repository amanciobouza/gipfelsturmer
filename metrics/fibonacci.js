/**
 * Created by bouza on 17/06/17.
 * The Fibonacci calculates price levels based on the Fibonacci sequence.
 * The financial theory: market prices are returning and search for Fibonacci levels.
 */
var Fibonacci = module.exports = {};

var PREFIX = 'fib_';

Fibonacci.searchLevel = function (aLowPrice, aHighPrice, aPrice, someFibonacciPriceLevels, aFibonacciLevelToleranceRange) {
    var diff = aHighPrice - aLowPrice;
    var range = diff * aFibonacciLevelToleranceRange;

    for (var i = someFibonacciPriceLevels.length - 1; i > 0; i--) {
        if (aPrice > someFibonacciPriceLevels - range && aPrice < someFibonacciPriceLevels + range) {
            return someFibonacciPriceLevels[i];
        }
    }

    return null;
};

Fibonacci.calcPriceLevel = function (aLowPrice, aHighPrice, aFibonacciLevel) {
    var diff = aHighPrice - aLowPrice;
    return aLowPrice + aFibonacciLevel * diff;
};

Fibonacci.createIdentifier = function (aLevel) {
    return PREFIX + parseFloat(aLevel * 100).toFixed(1);
};

Fibonacci.count = function (anIndex) {
    if (anIndex < 3) {
        return 1;
    }

    var fibValue = 1;
    var prevFibValue = 1;

    for (var i = 2; i < anIndex; i++) {
        var currentFibValue = fibValue;
        fibValue = fibValue + prevFibValue;
        prevFibValue = currentFibValue;
    }

    return fibValue;
};