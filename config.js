/**
 * Created by bouza on 17/06/17.
 */
var configurations = module.exports = {};
var fs = require('fs');

const BTC_TUSD = "BTC_TUSD";
const ETH_TUSD = "ETH_TUSD";
const LTE_TUSD = "LTE_TUSD";

const CHARSET = "UTF-8";
const configFile = "./resources/config.json";

var configuration = {};

/**
 * ################################
 * ### TRANSACTIONS ###############
 * ################################
 */

configurations.getBuyStack = function (anId) {
    return get(anId).transactions;
};

configurations.setBuyStack = function (aBuyStack, anId) {
    get(anId).transactions = aBuyStack;
    write(configuration);
};

/**
 * ################################
 * ### SETTINGS ###################
 * ################################
 */
configurations.getMaxOrders = function (anId) {
    return get(anId).settings.maxOrders;
};
configurations.getHighNoiseFilterRate = function (anId) {
    return get(anId).settings.highNoiseFilterRate;
};
configurations.getLowNoiseFilterRate = function (anId) {
    return get(anId).settings.lowNoiseFilterRate;
};
configurations.getNoiseFilterDropRate = function (anId) {
    return get(anId).settings.noiseFilterDropRate;
};
configurations.getMinTradeRange = function (anId) {
    return get(anId).settings.minTradeRange;
};
configurations.getPriceSimilarityRange = function (anId) {
    return get(anId).settings.priceSimilarityRange;
};
configurations.getMaxBuyStackSize = function (anId) {
    return get(anId).settings.maxBuyStack;
};
configurations.getTradeAmounts = function (anId) {
    return get(anId).settings.tradeAmounts;
};
configurations.isInstantTrade = function (anId) {
    return get(anId).settings.instantTrade;
};

/**
 * ################################
 * ### MARGIN TRADING #############
 * ################################
 */
configurations.isMarginTradingActive = function (anId) {
    return get(anId).marginTrading.active;
};
configurations.getMarginTradingMultiplier = function (anId) {
    return get(anId).marginTrading.multiplier;
};

/**
 * ################################
 * ### ACCOUNT ####################
 * ################################
 */
configurations.getAccount = function (anId) {
    return get(anId).account;
};
configurations.getOrderLimit = function (anId) {
    return get(anId).account.orderLimit;
};
configurations.setOrderLimit = function (anOrderLimit, anId) {
    get(anId).account.orderLimit = anOrderLimit;
    write(configuration);
};
configurations.getBudget = function (anId) {
    return get(anId).account.budget;
};
configurations.setBudget = function (aBudget, anId) {
    var config = fs.readFileSync(configFile, "UTF-8");
    var newConfig = JSON.parse(config);
    newConfig[anId].account.budget = aBudget;
    fs.writeFileSync(configFile, JSON.stringify(newConfig, null, 2));
};
configurations.getBalance = function (anId) {
    return get(anId).account.balance;
};
configurations.setBalance = function (aBalance, anId) {
    get(anId).account.balance = aBalance;
    write(configuration);
};
configurations.addBalance = function (aBalance, anId) {
    console.log(anId + "\t adding Balance: " + configurations.getBalance(anId) + " + " + aBalance);
    configurations.setBalance(configurations.getBalance(anId) + aBalance, anId);
};
configurations.getCurrencyPair = function (anId) {
    return get(anId).account.currencyPair;
};

/**
 * ################################
 * ### ANALYTICS ##################
 * ################################
 */
configurations.getEMAPeriodA = function (anId) {
    return get(anId).analytics.macd.emaPeriodA;
};

configurations.getEMAPeriodB = function (anId) {
    return get(anId).analytics.macd.emaPeriodB;
};

configurations.getEMAPeriodC = function (anId) {
    return get(anId).analytics.macd.emaPeriodC;
};

configurations.getMACDCoefficient = function (anId) {
    return get(anId).analytics.macd.macdCoefficient;
};

configurations.isMACDActive = function (anId) {
    return get(anId).analytics.macd.active;
};

configurations.getFibonacciLevelRange = function (anId) {
    return get(anId).analytics.fibonacciLevel.range;
};

configurations.getFibonacciLevels = function (anId) {
    return get(anId).analytics.fibonacciLevel.levels;
};

configurations.isFibonacciActive = function (anId) {
    return get(anId).analytics.fibonacciLevel.active;
};

configurations.getRSIPeriod = function (anId) {
    return get(anId).analytics.rsi.period;
};

configurations.getRSIOverbought = function (anId) {
    return get(anId).analytics.rsi.overbought;
};

configurations.getRSIOversold = function (anId) {
    return get(anId).analytics.rsi.oversold;
};

configurations.isRSIActive = function (anId) {
    return get(anId).analytics.rsi.active;
};

configurations.isDynamicProfitRateActive = function (anId) {
    return get(anId).analytics.dynamicProfitRate.active;
};

configurations.getDynamicProfitRateRatio = function (anId) {
    return get(anId).analytics.dynamicProfitRate.ratio;
};

configurations.getTargetProfitRate = function (anId) {
    return get(anId).analytics.dynamicProfitRate.targetRate;
};

configurations.setTargetProfitRate = function (aTargetProfitRate, anId) {
    get(anId).analytics.dynamicProfitRate.targetRate = aTargetProfitRate;
    write(configuration);
};

/**
 * ################################
 * ### POLONIEX ###################
 * ################################
 */
configurations.getSellFee = function (anId) {
    return get(anId).poloniex.sellFee;
};
configurations.getBuyFee = function (anId) {
    return get(anId).poloniex.buyFee;
};

/**
 * ################################
 * ### GOOGLE #####################
 * ################################
 */
configurations.getSpreadsheetId = function (anId) {
    return get(anId).google.spreadsheetId;
};

configurations.isWriteTickerActive = function (anId) {
    return get(anId).google.writeTicker;
};

configurations.getTickerLimit = function (anId) {
    return get(anId).google.tickerLimit;
};
/**
 * ################################
 * ### GENERAL ####################
 * ################################
 */
configurations.getTraderIds = function () {
    return Object.keys(read());
};

configurations.isActive = function (anId) {
    return get(anId).active;
};

configurations.isSimulation = function (anId) {
    return get(anId).simulated;
};
configurations.isDebuggingActive = function (anId) {
    return get(anId).debug;
};

configurations.getConfig = function (anId) {
    return get(anId);
};

configurations.reload = function () {
    reload();
};
reload = function () {
    try {
        configuration = JSON.parse(fs.readFileSync(configFile, CHARSET));
    } catch (err) {
        console.log(err);
    }
};

function get (anId) {
    return read()[anId];
}

function read() {
    reload();
    return configuration;
}

function write(aConfig) {
    fs.writeFileSync(configFile, JSON.stringify(aConfig, null, 2));
    configurations.reload();
}

configurations.initialize = function () {
    console.log("Initializing configuration ...");
    configurations.reload();
    console.log("OK.");
};

