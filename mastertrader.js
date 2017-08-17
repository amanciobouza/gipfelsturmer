/**
 * Created by bouza on 17/06/17.
 * Trader creates orders to buy and sell coins. To this goal, it monitors the market ticker.
 * Range Trading Strategy.
 *
 * Process:
 * 1. Get Ticker
 * 2. Analyze Situation
 * 3. Update Orders for new sells or buys
 * 4. Place Orders to sell or buy
 */
var _ = require('lodash');

var analyzer = require('./analyzer');
var bittrexAPI = require('./market/bittrexAPI');
var configurations = require('./config');
var googleAPI = require('./googlespreadsheetAPI');
var fibonacci = require('./metrics/fibonacci');
var stats = require('./metrics/stats');

var masterTrader = module.exports = {};

const TYPE_SELL = 'sell';
const TYPE_BUY = 'buy';

var traders = [];

/**
 * ################################
 * ### Receive Market Updates #####
 * ################################
 */
function receiveMarketUpdate(aTicker, aTickerHistory, aMarketAnalysis, aTraderId) {
    //Initialize
    initializeTrader(aTraderId);
    googleAPI.initializeTrader(aTraderId);
    var trader = findTrader(aTraderId);
    aTicker.simulated = configurations.isSimulation(aTraderId);
    //Adapt prizes

    //not yet ready to trade
    if (_.isNil(aMarketAnalysis)) {
        return;
    }

    //not enough historic data to trade
    if (_.isNil(aMarketAnalysis.price.macdSignal) || _.isNaN(aMarketAnalysis.price.macdSignal)) {
        if (configurations.isWriteTickerActive(aTraderId)) {
            googleAPI.bufferTicker(aTicker, aTraderId);
        }

        log("Trading starts in " + (configurations.getEMAPeriodA(aTraderId) + configurations.getEMAPeriodB(aTraderId) - aTickerHistory.length), aTraderId);
        return;
    }

    //add noise filter info to ticker
    trader.highNoiseFilter = Math.max(trader.highNoiseFilter * (1 - configurations.getNoiseFilterDropRate(aTraderId)), aMarketAnalysis.price.macd * configurations.getHighNoiseFilterRate(aTraderId));
    trader.lowNoiseFilter = Math.min(trader.lowNoiseFilter * (1 - configurations.getNoiseFilterDropRate(aTraderId)), aMarketAnalysis.price.macd * configurations.getLowNoiseFilterRate(aTraderId));
    aTicker.highNoiseFilter = trader.highNoiseFilter;
    aTicker.lowNoiseFilter = trader.lowNoiseFilter;

    //try trading
    var isBuy = tryBuying(aMarketAnalysis, aTraderId);
    var isSell = trySelling(aMarketAnalysis, aTraderId);

    //extend ticker with transaction info
    if (isBuy) {
        aTicker.buyRate = calcTradeRate(aMarketAnalysis.price.last, aMarketAnalysis.price.lowestAsk, aTraderId);
        aTicker.sellRate = "";
        aTicker.buyAmount = isBuy;
        aTicker.sellAmount = "";
        aTicker.buyTotal = aTicker.buyRate * aTicker.buyAmount;
        aTicker.sellTotal = "";
        googleAPI.writeTransaction(aTicker, configurations.getSpreadsheetId(aTraderId));
    } else if (isSell) {
        aTicker.buyRate = "";
        aTicker.sellRate = calcTradeRate(aMarketAnalysis.price.last, aMarketAnalysis.price.highestBid, aTraderId);
        aTicker.buyAmount = "";
        aTicker.sellAmount = isSell;
        aTicker.buyTotal = "";
        aTicker.sellTotal = aTicker.sellRate * aTicker.sellAmount;
        googleAPI.writeTransaction(aTicker, configurations.getSpreadsheetId(aTraderId));
    } else {
        aTicker.buyRate = "";
        aTicker.sellRate = "";
        aTicker.buyAmount = "";
        aTicker.sellAmount = "";
        aTicker.buyTotal = "";
        aTicker.sellTotal = "";
    }

    //Must be after Buying and selling because Fibonacci Level Enter test.
    if (!_.isNil(aMarketAnalysis.price.fibonacci.last)) {
        if (trader.lastFibonacciLevel !== aMarketAnalysis.price.fibonacci.last) {
            trader.lastFibonacciLevel = aMarketAnalysis.price.fibonacci.last;
        }
    }

    if (configurations.isWriteTickerActive(aTraderId)) {
        googleAPI.bufferTicker(aTicker, aTraderId);
    }
}

function adaptPrizes(aTraderId) {
    var buyStack = configurations.getBuyStack(aTraderId);
    var priceAdaptionRate = configurations.getPriceAdaptationRate(aTraderId);

    for (var i = 0; i < buyStack.length; i++) {
        buyStack[i].price = buyStack[i].price * (1 + priceAdaptionRate);
    }

    configurations.setBuyStack(buyStack, aTraderId);
}

/**################################
 * #### BUY AND SELL ##############
 * ################################*/
function tryBuying(aMarketAnalysis, aTraderId) {
    var trader = findTrader(aTraderId);
    var buyStack = configurations.getBuyStack(aTraderId);
    var buyRate = calcTradeRate(aMarketAnalysis.price.last, aMarketAnalysis.price.lowestAsk, aTraderId);
    var now = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');

    //ELIGIBILITY
    var amountMultiplier = calcAmountMultiplier(aMarketAnalysis, TYPE_BUY, configurations.getTradeAmounts(aTraderId));
    var amountToBuy = normalizePrice(amountMultiplier * configurations.getOrderLimit(aTraderId) / buyRate);
    if (amountToBuy > configurations.getBalance(aTraderId) / buyRate) {
        log(now + ": No Buying\t- not enough balance to buy.\t\t" + configurations.getBalance(aTraderId) + "Ƀ, " + amountToBuy + "Ƀ needed. Adapting prizes.", aTraderId);
        adaptPrizes(aTraderId);
        return false;
    }
    //no budget to buy
    if (buyStack.length > configurations.getMaxBuyStackSize(aTraderId)) {
        log(now + ": No Buying\t- buy stack is full.\t\t[" + buyStack.length + "]", aTraderId);
        return false;
    }

    //MACD
    if (configurations.isMACDActive(aTraderId)) {
        //no trend change
        if (!(aMarketAnalysis.price.macd > aMarketAnalysis.price.macdSignal
                && aMarketAnalysis.price.macdprev <= aMarketAnalysis.price.macdSignalprev)) {
            return false;
        }

        //is not positive trend
        if (aMarketAnalysis.price.macd > 0) {
            //log(now + ": No Buying\t- not a positive trend.\t\t[MACD > 0]", aTraderId);
            return false;
        }

        //no significant trade change
        if (aMarketAnalysis.price.macd > trader.lowNoiseFilter) {
            //log(now + ": No Buying\t- not a significant trade change.\t\t[noise filter]", aTraderId);
            return false;
        }
    }

    //don't repeat action on same level to avoid short term oscillation
    let similarPrice = isInFibonacciPriceRange(buyRate, configurations.getMinTradeRange(aTraderId), configurations.getBuyStack(aTraderId));
    if (similarPrice) {
        log(now + ": No Buying\t- already bought at similar buy rate.\t\t[now " + buyRate + "Ƀ | prev " + similarPrice + "Ƀ]", aTraderId);
        return false;
    }

    //Fibonacci
    if (configurations.isFibonacciActive(aTraderId)) {
        //too close to highest price levels
        if (aMarketAnalysis.price.fibonacci.level === 1) {
            log(now + ": No Buying\t- too close to highest price rate.\t\t[Fibonacci 100%]", aTraderId);
            return false;
        }
        //not close to fibonacci level
        if (_.isNil(aMarketAnalysis.price.fibonacci.level) && buyRate > aMarketAnalysis.price.fibonacci['fib_23.8']) {
            log(now + ": No Buying\t- not close enough to any fibonacci level.", aTraderId);
            return false;
        }
    }

    //RSI
    if (configurations.isRSIActive(aTraderId)) {
        //too close to lowest price levels
        if (aMarketAnalysis.price.rsi.rsi > configurations.getRSIOversold(aTraderId)) {
            log(now + ": No Buying\t- not oversold.", aTraderId);
            return false;
        }
    }

    //calc amount to buy
    addOrderToStack(buyRate, amountToBuy, configurations.getBuyFee(aTraderId), aTraderId);

    var budget = configurations.getBudget(aTraderId) - buyRate * amountToBuy * configurations.getBuyFee(aTraderId);
    configurations.setBudget(budget, aTraderId);
    var balanceChange = -1 * buyRate * amountToBuy;
    configurations.addBalance(balanceChange, aTraderId);

    buy(configurations.getCurrencyPair(aTraderId), buyRate, amountToBuy, registerOrder, aTraderId);


    trader.lastBuyRate = buyRate;
    return amountToBuy;
}

function buy(aCurrencyPair, aBuyRate, anAmount, aCallback, aTraderId) {
    var now = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
    if (!configurations.isSimulation(aTraderId)) {
        log('$$$$$$$$ BUY ' + anAmount + '@' + aBuyRate + 'Ƀ\tBalance: ' + configurations.getBudget(aTraderId) + 'Ƀ\t- ' + now, aTraderId);
        bittrexAPI.buy(aCurrencyPair, aBuyRate, anAmount, aCallback);
    } else {
        log('ssssssss BUY ' + anAmount + '@' + aBuyRate + 'Ƀ\tBalance: ' + configurations.getBudget(aTraderId) + 'Ƀ\t- ' + now, aTraderId);
    }
}

function trySelling(aMarketAnalysis, aTraderId) {
    var trader = findTrader(aTraderId);
    var sellRate = calcTradeRate(aMarketAnalysis.price.last, aMarketAnalysis.price.highestBid, aTraderId);
    var now = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');

    //ELIGIBILITY
    //nothing to sell
    if (configurations.getBuyStack(aTraderId).length === 0) {
        //log(now + ": No Selling\t- nothing to sell.", aTraderId);
        return false;
    }

    //MACD
    if (configurations.isMACDActive(aTraderId)) {
        //no trend change
        if (!(aMarketAnalysis.price.macd < aMarketAnalysis.price.macdSignal
                && aMarketAnalysis.price.macdprev >= aMarketAnalysis.price.macdSignalprev)) {
            return false;
        }

        //is not positive trend
        if (aMarketAnalysis.price.macd < 0) {
            //log(now + ": No Selling\t- not a negative trend.\t\t[MACD < 0]", aTraderId);
            return false;
        }

        //no significant trade change
        if (aMarketAnalysis.price.macd < trader.highNoiseFilter) {
            //log(now + ": No Selling\t- not a significant trade change.\t\t[noise filter]", aTraderId);
            return false;
        }
    }

    //FIBONACCI
    if (configurations.isFibonacciActive(aTraderId)) {
        //too close to lowest price levels
        if (aMarketAnalysis.price.fibonacci.level === 0) {
            log(now + ": No Selling\t- too close to lowest price rate.\t\t[Fibonacci 0%]", aTraderId);
            return false;
        }
    }

    //RSI
    if (configurations.isRSIActive(aTraderId)) {
        //too close to lowest price levels
        if (aMarketAnalysis.price.rsi.rsi < configurations.getRSIOverbought(aTraderId)) {
            log(now + ": No Selling\t- not overbought.", aTraderId);
            return false;
        }
    }

    //DYNAMIC PROFIT
    var targetTradeProfitRate = calcTargetTradeProfitRate(aMarketAnalysis, aTraderId);
    var amountToTrade = calcMaxAmountToSell(sellRate, targetTradeProfitRate, aTraderId);
    if (!amountToTrade) {
        log(now + ": No Selling\t- below buy rates \t\t[sell@" + sellRate + "Ƀ | " + targetTradeProfitRate + "%]", aTraderId);
        return false;
    }

    clearBuyStack(aTraderId, sellRate, targetTradeProfitRate);

    var budget = configurations.getBudget(aTraderId) + sellRate * amountToTrade * configurations.getSellFee(aTraderId);
    configurations.setBudget(budget, aTraderId);
    configurations.setOrderLimit(budget / configurations.getMaxOrders(aTraderId), aTraderId);
    var balanceChange = sellRate * amountToTrade * (1 - configurations.getSellFee(aTraderId));
    configurations.addBalance(balanceChange, aTraderId);

    sell(configurations.getCurrencyPair(aTraderId), sellRate, amountToTrade, registerOrder, aTraderId);

    trader.lastSellRate = sellRate;
    return amountToTrade;
}

function calcTargetTradeProfitRate(aMarketAnalysis, aTraderId) {
    var result = configurations.getMinTradeRange(aTraderId);
    if (configurations.isDynamicProfitRateActive(aTraderId)) {
        var targetProfitRate = calcTargetProfitRate(1 - (aMarketAnalysis.price.min / aMarketAnalysis.price.max), configurations.getDynamicProfitRateRatio(aTraderId));
        result = Math.max(configurations.getMinTradeRange(aTraderId), targetProfitRate);
    }

    return result;
}

function sell(aCurrencyPair, aSellRate, anAmount, aCallback, aTraderId) {
    var now = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
    if (!configurations.isSimulation(aTraderId)) {
        log('$$$$$$$$ SELL ' + anAmount + '@' + aSellRate + 'Ƀ\tBalance: ' + configurations.getBudget(aTraderId) + 'Ƀ\t- ' + now, aTraderId);

        bittrexAPI.sell(aCurrencyPair, aSellRate, anAmount, aCallback);
    } else {
        log('ssssssss SELL ' + anAmount + '@' + aSellRate + 'Ƀ\tBalance: ' + configurations.getBudget(aTraderId) + 'Ƀ\t- ' + now, aTraderId);
    }
}

function calcTradeRate(lastPrice, alternativePrice, aTraderId) {
    if (configurations.isInstantTrade(aTraderId)) {
        return +lastPrice;
    } else {
        return +alternativePrice;
    }
}

function normalizePrice(aPrice) {
    return parseFloat(aPrice).toFixed(8);
}

function calcMaxAmountToSell(aPrice, someFees, aTraderId) {
    var buyStack = configurations.getBuyStack(aTraderId);
    var result = 0;
    for (var i = 0; i < buyStack.length; i++) {
        if (aPrice > buyStack[i].price * (1 + someFees)) {
            result += buyStack[i].amount;
        }
    }

    return result * (1 - configurations.getBuyFee(aTraderId));
}

function clearBuyStack(aTraderId, aPrice, someFees) {
    var buyStack = configurations.getBuyStack(aTraderId);
    var newBuyStack = [];
    for (var i = 0; i < buyStack.length; i++) {
        if (!(aPrice > buyStack[i].price * (1 + someFees))) {
            newBuyStack.push(buyStack[i]);
        }
    }
    buyStack = newBuyStack;
    configurations.setBuyStack(buyStack, aTraderId);
}

function isSimilarPrice(aPrice, aMinTradeRange, aBuyStack) {
    for (var i = 0; i < aBuyStack.length; i++) {
        var buyStackPrice = aBuyStack[i].price;
        if (_.inRange(aPrice, buyStackPrice * (1 - aMinTradeRange), buyStackPrice * (1 + aMinTradeRange))) {
            return buyStackPrice;
        }
    }
    return false;
}

function isInFibonacciPriceRange(aPrice, aMinTradeRange, aBuyStack) {
    if (aBuyStack.length < 3) {
        return isSimilarPrice(aPrice, aMinTradeRange, aBuyStack);
    }

    var maxPrice = stats.calcMaxPrice(extractPricesFromBuyStack(aBuyStack));
    if (aPrice > maxPrice) {
        return isSimilarPrice(aPrice, aMinTradeRange, aBuyStack);
    }

    var fibonacciCounter = fibonacci.count(aBuyStack.length + 1);

    var minPrice = maxPrice - fibonacciCounter * (aMinTradeRange * maxPrice);
    if (_.inRange(aPrice, maxPrice, minPrice)) {
        return minPrice;
    }

    return false;
}

function extractPricesFromBuyStack(aBuyStack) {
    var results = [];
    for (var i = 0; i < aBuyStack.length; i++) {
        results.push(aBuyStack[i].price);
    }
    return results;
}

function calcAmountMultiplier(aMarketAnalysis, aType, someAmounts) {
    if (aType === TYPE_BUY) {
        if (aMarketAnalysis.price.fibonacci.lastLevel >= 1) {
            return someAmounts[0];
        } else if (aMarketAnalysis.price.fibonacci.lastLevel >= 0.618) {
            return someAmounts[1];
        } else if (aMarketAnalysis.price.fibonacci.lastLevel >= 0.5) {
            return someAmounts[2];
        } else if (aMarketAnalysis.price.fibonacci.lastLevel >= 0.38) {
            return someAmounts[3];
        } else if (aMarketAnalysis.price.fibonacci.lastLevel >= 0.236) {
            return someAmounts[4];
        } else {
            return someAmounts[5];
        }
    } else if (aType === TYPE_SELL) {
        if (aType === TYPE_BUY) {
            if (aMarketAnalysis.price.fibonacci.lastLevel <= 0) {
                return someAmounts[5];
            } else if (aMarketAnalysis.price.fibonacci.lastLevel <= 0.236) {
                return someAmounts[4];
            } else if (aMarketAnalysis.price.fibonacci.lastLevel <= 0.38) {
                return someAmounts[3];
            } else if (aMarketAnalysis.price.fibonacci.lastLevel <= 0.5) {
                return someAmounts[2];
            } else if (aMarketAnalysis.price.fibonacci.lastLevel <= 0.618) {
                return someAmounts[1];
            } else {
                return someAmounts[0];
            }
        }
    }
}

function addOrderToStack(aPrice, anAmount, aFee, aTraderId) {
    var buyStack = configurations.getBuyStack(aTraderId);
    var order = {};
    order.originalPrice = +aPrice;
    order.price = +aPrice;
    order.amount = anAmount * (1 - aFee);
    order.datetime = new Date().toISOString();

    buyStack.push(order);
    configurations.setBuyStack(buyStack, aTraderId);
}

function registerOrder(anOrder) {
    console.log('Order registered:' + JSON.stringify(anOrder));
}

function log(aMessage, aTraderId, doForce) {
    if (doForce || configurations.isDebuggingActive(aTraderId)) {
        console.log(aTraderId + "\t" + aMessage);
    }
}

masterTrader.initialize = function () {
    analyzer.initialize(receiveMarketUpdate);
};

/**
 * ################################
 * ### INITIALIZE TRADERS #########
 * ################################
 */
function initializeTrader(aTraderId) {
    var trader = findTrader(aTraderId);
    if (_.isNil(trader)) {
        traders.push(createTrader(aTraderId));
    }

}

function createTrader(aTraderId) {
    var result = {};
    result.id = aTraderId;
    result.lastBuyRate = null;
    result.lastSellRate = null;
    result.lastFibonacciLevel = null;
    result.highNoiseFilter = 0;
    result.lowNoiseFilter = 0;
    return result;
}

function findTrader(aTraderId) {
    for (var i = 0; i < traders.length; i++) {
        if (traders[i].id === aTraderId) {
            return traders[i];
        }
    }
    return null;
}

function calcTargetProfitRate(aMarketProfit, aTargetProfitRatio) {
    return aMarketProfit * aTargetProfitRatio;
}