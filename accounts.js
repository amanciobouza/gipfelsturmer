/**
 * Accounts manages the balances.
 * Created by bouza on 18/06/17.
 */
var accounts = module.exports = {};
var poloniex = require('./market/poloniexAPI');

var balances = {};
var orders = {};

var botOrders = {};

var observer = null;

const TYPE_SELL = 'sell';
const TYPE_BUY = 'buy';

/**
 * Initializes the balances
 * @param someBalances
 */
function setBalances(someBalances) {
    balances = someBalances;
}

/**
 * Init balances.
 */
function initBalances() {
    console.log('Init balances and accounts...');
    poloniex.returnBalances(setBalances);
}

/**
 * Initializes the orders
 */
function setOpenOrders(someOpenOrders) {
    orders = someOpenOrders
    /*
     var currencies = Object.keys(someOpenOrders);
     for (var i = 0; i < currencies.length; i++) {
        var currency = currencies[i];
        orders[currency] = [];

        var currencyOrders = someOpenOrders[currency];
        for (var j = 0; j < currencyOrders.length; j++) {
            var currencyOrder = currencyOrders[j];
            var order = {};
            order.id = currencyOrder.orderNumber;
            order.date =  currencyOrder.date;
            order.rate = currencyOrder.rate;
            order.amount = currencyOrder.amount;
            order.total = currencyOrder.total;
            if (currencyOrder.type === TYPE_SELL) {
                orders[currency].sell.push(order);
            } else if (currencyOrder.type === TYPE_BUY) {
                orders[currency].buy.push(order);
            }
        }
    }*/
}

/**
 * Init open orders.
 */
function initOpenOrders() {
    console.log('Init open orders...');
    poloniex.returnOpenOrders(setOpenOrders);
}

function initObserver(anObserver) {
    observer = anObserver;
}

function getObserver() {
    return observer;
}


accounts.getBalance = function () {
    return balances;
};

accounts.getOrders = function () {
    return orders;
};

accounts.initialize = function (anObserver) {
    initBalances();
    initOpenOrders();
    initObserver(anObserver);
};

accounts.registerTrader = function (aTraderId) {
    botOrders[aTraderId] = [];
};

accounts.getBuyOrders = function (aTraderId) {
    return getOrdersOfType(aTraderId, TYPE_BUY);
};
accounts.getSellOrders = function (aTraderId) {
    return getOrdersOfType(aTraderId, TYPE_SELL);
};

function getOrdersOfType(aTraderId, aType) {
    var traderOrders = accounts.getOrders(aTraderId);
    var results = [];
    for (var i = 0; i < traderOrders.length; i++) {
        if (traderOrders[i].type === aType) {
            results.push(traderOrders[i]);
        }
    }
    return results;
}

accounts.getOrders = function (aTraderId) {
    var results = [];
    var orders = botOrders[aTraderId];
    for (var i = 0; i < orders.length; i++) {
        var order = findOrder(orders[i]);
        if (order === null) {
        } else {
            results.push(order);
        }
    }

    return results;
};

function findOrder(anOrderId) {
    var currencyPairs = Object.keys(orders);
    for (var i = 0; i < currencyPairs.length; i++) {
        var result = findOrderInCurrencyPair(anOrderId, currencyPairs[i]);
        if (result === null) {
        } else {
            return result;
        }
    }
    return null;
}

function findOrderInCurrencyPair(anOrderId, aCurrencyPair) {
    var currencyOrders = orders[aCurrencyPair];
    for (var i = 0; i < currencyOrders.length; i++) {
        if (anOrderId === currencyOrders[i]) {
            return currencyOrders[i];
        }
    }
    return null;
}

accounts.addOrder = function (anOrder, aTraderId, aCurrencyPair) {
    if (anOrder.error === null) return;
    getBotOrders(aTraderId).push(anOrder.orderNumber);
    orders[aCurrencyPair].push(anOrder);

    if (getObserver() === null) return;
    getObserver(anOrder, aTraderId, aCurrencyPair);

};

function getBotOrders(aTraderId) {
    return botOrders[aTraderId];
}




