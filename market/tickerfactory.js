var _ = require('lodash');

var tickerFactory = module.exports = {};

tickerFactory.create = function (aMarketName, aLastPrice, aLowestAsk, aHighestBid, aHighest24hrPrice, aLowest24hrPrice, aPercentageChange, aBaseVolume, aQuoteVolume, aNumberOfOpenBuyOrders, aNumberOfOpenSellOrders) {
    var result = {};
    result.marketName = normMarketName(aMarketName);
    result.lastPrice = aLastPrice;
    result.lowestAsk = aLowestAsk;
    result.highestBid = aHighestBid;
    result.highest24hrPrice = aHighest24hrPrice;
    result.lowest24hrPrice = aLowest24hrPrice;
    result.baseVolume = aBaseVolume;
    result.quoteVolume = aQuoteVolume;
    result.openBuyOrders = aNumberOfOpenBuyOrders;
    result.openSellOrders = aNumberOfOpenSellOrders;
    result.percentChange = aPercentageChange;
    return result;
};

function normMarketName(aMarketName) {
    var result = aMarketName.toUpperCase();
    result = result.replace('_', '-');
    return result;
}
