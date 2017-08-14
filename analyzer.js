/**
 * Created by bouza on 17/06/17.
 * The analyzer monitors and analyzes market tickers.
 * It extends the ticker info with calculated metrics previous to providing the info to the trader.
 */
var _ = require('lodash');

var ticker = require('./market/ticker');

var configurations = require('./config');
var EMA = require('./metrics/ema');
var MACD = require('./metrics/macd');
var Fibonacci = require('./metrics/fibonacci');
var RSI = require('./metrics/rsi');
var Stats = require('./metrics/stats');

var traders = [];
var callback = null;
var maxTickerHistoryWindowLength = 4320;    //24h=17280; 12h=8640 ; 8h=5760; 6h=4320; 4h=2880; 3h=2160; 2h=1440; 1h=720;
var analyzer = module.exports = {};

/**
 * ################################
 * ### MARKET TICKER ##############
 * ################################
 */
function receiveMarketTicker(someTickers) {
    initializeTraders(configurations.getTraderIds());

    for (var i = 0; i < traders.length; i++) {
        if (configurations.isActive(traders[i].id)) {
            handleMarketTickerByTrader(someTickers, traders[i]);
        }
    }
}

function handleMarketTickerByTrader(aMarketTicker, aTrader) {
    var currencyPair = configurations.getCurrencyPair(aTrader.id);
    var ticker = getMarketTicker(aMarketTicker, currencyPair);
    if (_.isNil(ticker)) {
        return;
    }

    ticker.currencyPair = currencyPair;
    addTickerToHistory(ticker, aTrader);

    var priceHistory = getPriceHistory(aTrader.tickerHistory);
    var marketAnalysis = analyzeMarketWindow(aTrader.tickerHistory, priceHistory, aTrader);
    extendTicker(ticker, marketAnalysis, aTrader);

    callback(ticker, aTrader.tickerHistory, marketAnalysis, aTrader.id);
}

function extendTicker(aTicker, aMarketAnalysis, aTrader) {
    aTicker.datetime = createDateTime();
    aTicker.date = createDate();
    var traderId = aTrader.id;

    var fibonacciLevelIds = Object.keys(aMarketAnalysis.price.fibonacci);
    for (var i = 0; i < fibonacciLevelIds.length; i++) {
        aTicker[fibonacciLevelIds[i]] = aMarketAnalysis.price.fibonacci[fibonacciLevelIds[i]];
    }

    aTicker.sma = aMarketAnalysis.price.sma;
    aTicker.rsi = aMarketAnalysis.price.rsi.rsi;
    aTicker.rsiOverbought = aMarketAnalysis.price.rsi.overbought;
    aTicker.rsiOversold = aMarketAnalysis.price.rsi.oversold;
    aTicker.emaA = aMarketAnalysis.price.emaA;
    aTicker.emaB = aMarketAnalysis.price.emaB;
    aTicker.macd = aMarketAnalysis.price.macd;
    aTicker.macdSignal = aMarketAnalysis.price.macdSignal;


    aTicker.highNoiseFilter = Math.max(aTrader.highNoiseFilter * (1 - configurations.getNoiseFilterDropRate(traderId)), aMarketAnalysis.price.macd * configurations.getHighNoiseFilterRate(traderId));
    aTicker.lowNoiseFilter = Math.min(aTrader.lowNoiseFilter * (1 - configurations.getNoiseFilterDropRate(traderId)), aMarketAnalysis.price.macd * configurations.getLowNoiseFilterRate(traderId));
}

analyzer.analyzeMarketWindow = function (aTickerHistory, aPriceHistory, aTraderId) {
    var trader = findTrader(aTraderId);
    if (_.isNil(trader)) {
        return null;
    }

    return analyzeMarketWindow(aTickerHistory, aPriceHistory, trader);
};

function analyzeMarketWindow(aTickerHistory, aPriceHistory, aTrader) {
    var result = {};
    var traderId = aTrader.id;
    var lastTicker = aTickerHistory[aTickerHistory.length - 1];
    var firstTicker = aTickerHistory[0];

    //set current price situation
    result.price = {};
    var lastPrice = getLastPrice(lastTicker);
    result.price.last = normalizePrice(lastPrice);
    result.price.first = normalizePrice(getLastPrice(firstTicker));
    result.price.highestBid = normalizePrice(getHighestBid(lastTicker));
    result.price.lowestAsk = normalizePrice(getLowestAsk(lastTicker));

    //set stats
    var lowestPrice = Stats.calcMinPrice(aPriceHistory);
    var highestPrice = Stats.calcMaxPrice(aPriceHistory);
    result.price.min = normalizePrice(lowestPrice);
    result.price.max = normalizePrice(highestPrice);
    var centerPrice = Stats.calcCenterPrice(aPriceHistory);
    result.price.center = normalizePrice(centerPrice);
    var priceRange = Stats.calcRange(aPriceHistory);
    result.price.range = normalizePrice(priceRange);
    var averagePrice = Stats.calcAveragePrice(aPriceHistory);
    result.price.avg = normalizePrice(averagePrice);

    result.price.sma = normalizePrice(EMA.calcMovingAverage(aPriceHistory, configurations.getEMAPeriodB(aTrader.id)));

    result.price.rsi = extendRSIMetrics(aPriceHistory, configurations.getRSIPeriod(aTrader.id), configurations.getRSIOversold(aTrader.id), configurations.getRSIOverbought(aTrader.id));

    //set fibonacci Levels
    result.price.fibonacci = extendFibonacciLevelMetrics(result.price.min, result.price.max, lastPrice, configurations.getFibonacciLevels(aTrader.id), configurations.getFibonacciLevelRange(aTrader.id));

    //set MACD
    var emaPeriodA = configurations.getEMAPeriodA(traderId);
    var emaPeriodB = configurations.getEMAPeriodB(traderId);
    var emaPeriodC = configurations.getEMAPeriodC(traderId);
    var macdCoefficient = configurations.getMACDCoefficient(traderId);

    var emaA = EMA.calcExponentialMovingAverage(aPriceHistory, emaPeriodA, macdCoefficient);
    aTrader.emaA.push(emaA);
    if (aTrader.emaA.length > configurations.getEMAPeriodA(traderId)) {
        aTrader.emaA.splice(0, 1);
    }

    var emaB = EMA.calcExponentialMovingAverage(aPriceHistory, emaPeriodB, macdCoefficient);
    aTrader.emaB.push(emaB);
    if (aTrader.emaB.length > configurations.getEMAPeriodB(traderId)) {
        aTrader.emaB.splice(0, 1);
    }

    var macd = MACD.calcMACD(emaA, emaB);
    aTrader.macd.push(macd);
    if (aTrader.macd.length > configurations.getEMAPeriodC(traderId)) {
        aTrader.macd.splice(0, 1);
    }

    var macdSignal = EMA.calcExponentialMovingAverage(aTrader.macd, emaPeriodC, macdCoefficient);
    aTrader.macdSignal.push(macdSignal);
    if (aTrader.macdSignal.length > configurations.getEMAPeriodC(traderId)) {
        aTrader.macdSignal.splice(0, 1);
    }

    result.price.emaA = aTrader.emaA[aTrader.emaA.length - 1];
    result.price.emaB = aTrader.emaB[aTrader.emaB.length - 1];
    result.price.macd = aTrader.macd[aTrader.macd.length - 1];
    result.price.macdSignal = aTrader.macdSignal[aTrader.macdSignal.length - 1];

    result.price.emaAprev = aTrader.emaA[aTrader.emaA.length - 2];
    result.price.emaBprev = aTrader.emaB[aTrader.emaB.length - 2];
    result.price.macdprev = aTrader.macd[aTrader.macd.length - 2];
    result.price.macdSignalprev = aTrader.macdSignal[aTrader.macdSignal.length - 2];

    return result;
}

function extendFibonacciLevelMetrics(aLowestPrice, aHighestPrice, aPrice, someFibonacciLevels, aFibonacciLevelToleranceRange) {
    //Fibonacci Levels
    var result = {};

    //calculate fibonacci price levels
    var fibonacciPriceLevels = [];
    for (var i = 0; i < someFibonacciLevels.length; i++) {
        var level = someFibonacciLevels[i];
        var id = Fibonacci.createIdentifier(level);
        var price = Fibonacci.calcPriceLevel(aLowestPrice, aHighestPrice, level);
        result[id] = price;
        fibonacciPriceLevels.push(price);
    }

    //search fibonacci price level for current price
    result.level = Fibonacci.searchLevel(aLowestPrice, aHighestPrice, aPrice, fibonacciPriceLevels, aFibonacciLevelToleranceRange);
    if (null !== result.level) {
        result.lastLevel = result.level;
    }

    return result;
}

function extendRSIMetrics(aPriceHistory, aPeriod, anOversold, anOverbought) {
    var result = {};
    result.rsi = RSI.calcRelativeStrengthIndicator(aPriceHistory, aPeriod);
    result.oversold = anOversold;
    result.overbought = anOverbought;

    return result;
}

function getPriceHistory(aTickerHistory) {
    var results = [];
    for (var i = 0; i < aTickerHistory.length; i++) {
        results.push(getLastPrice(aTickerHistory[i]));
    }
    return results;
}

function addTickerToHistory(aTicker, aTrader) {
    for (var i = 0; i < traders.length; i++) {
        if (traders[i].id === aTrader.id) {
            traders[i].tickerHistory.push(aTicker);
            slideTickerHistoryWindow(traders[i].tickerHistory);
        }
    }
}

function slideTickerHistoryWindow(aTickerHistory) {
    if (aTickerHistory.length > maxTickerHistoryWindowLength) {
        aTickerHistory.splice(0, 1);
    }
}

/**########################################
 * ### INITIALIZE TRADERS #################
 * ########################################
 */
function initializeTraders() {
    var results = [];

    var traderIds = configurations.getTraderIds();

    for (var i = 0; i < traderIds.length; i++) {
        var traderId = traderIds[i];
        if (!isExistingTrader(traderId)) {
            results.push(createTrader(configurations.getCurrencyPair(traderId), traderId));
        } else {
            results.push(findTrader(traderId));
        }
    }

    traders = results;
}

function isExistingTrader(aTraderId) {
    return !(_.isNil(findTrader(aTraderId)));
}

function findTrader(anId) {
    for (var i = 0; i < traders.length; i++) {
        if (traders[i].id === anId) {
            return traders[i];
        }
    }
    return null;
}

function createTrader(aCurrencyPair, aTraderId) {
    var result = {};
    result.id = aTraderId;
    result.currencyPair = aCurrencyPair;
    result.tickerHistory = [];
    result.emaA = [];
    result.emaB = [];
    result.macd = [];
    result.macdSignal = [];
    return result;
}

/**########################################
 * ### TICKER EVENT ####################
 * ########################################
 */

function getLastPrice(aTicker) {
    if (_.isNumber(aTicker)) {
        return aTicker;
    }
    return +aTicker.lastPrice;
}

function getLowestAsk(aTicker) {
    return +aTicker.lowestAsk;
}

function getHighestBid(aTicker) {
    return +aTicker.highestBid;
}

function get24hrHigh(aTicker) {
    return +aTicker.highest24hrPrice;
}

function get24hrLow(aTicker) {
    return +aTicker.lowest24hrPrice;
}

function getMarketTicker(aMarketTicker, aMarketName) {
    for (var i = 0; i < aMarketTicker.length; i++) {
        if (aMarketTicker[i].marketName === aMarketName) {
            return aMarketTicker[i];
        }
    }
    return null;
}

function createDateTime() {
    return new Date().getUTCMonth() + 1 + '/' + new Date().getUTCDate() + '/' + new Date().getFullYear() + " " + new Date().getUTCHours() + ":" + new Date().getMinutes() + ":" + new Date().getUTCSeconds();
}

function createDate() {
    return new Date().getUTCMonth() + 1 + '/' + new Date().getUTCDate() + '/' + new Date().getFullYear();
}

function createGoogleDatetime() {
    return new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
}

/**
 * Rounds the number to a fixed length after the floating point.
 * @param aPrice
 * @param aFixedNumber
 * @returns {number}
 */
function normalizePrice(aPrice, aFixedNumber) {
    if (_.isNil(aPrice)) {
        return NaN;
    }

    if (aFixedNumber) {
        return +parseFloat(aPrice).toFixed(aFixedNumber);
    }
    return +parseFloat(aPrice).toFixed(8);
}

/**
 * ################################
 * ### START AND INITIALIZATIONS ##
 * ################################
 */
analyzer.initialize = function (aCallback) {
    console.log('Initializing market analyzer ...');
    callback = aCallback;
    initMarketTicker();
    console.log('OK.');
};

function initMarketTicker() {
    ticker.setTickerEvent(receiveMarketTicker);
    ticker.startTicker();
}