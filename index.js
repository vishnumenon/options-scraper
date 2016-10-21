var request = require('request-promise');
var Promise = require('bluebird');
var cheerio = require('cheerio');

/**
 * SCROLL TO BOTTOM FOR MAIN FUNCTION & USAGE EXAMPLE
 */

function getGreeksData(pages, priceData, ticker, greeksUrl, callback) {
    var greeksUrl = "http://www.nasdaq.com/symbol/" + ticker + "/option-chain/greeks?dateindex=-1";
    var pagePromises = [];
    for (var page = 1; page <= pages; page++) {
        pagePromises.push(request(greeksUrl + "&page=" + page).promise());
    }
    Promise.all(pagePromises).then(function(pageBodies) {
        pageBodies.map(function(body) {
            var $ = cheerio.load(body);
            $(".OptionsChain-chart tr").slice(1).each(function() {
                var cells = $(this).children();
                $(this).attr('class') !== "groupheader" && [0, 9].forEach(function(offset) {
                    var strike = parseFloat($(cells[8]).text());
                    var type = offset === 0 ? "call" : "put";
                    var expiry = $(cells[offset]).text();
                    var currentOptionMatches = priceData.filter(function(option) {
                        return option.strike === strike &&
                            option.type === type &&
                            option.ticker === ticker &&
                            option.expiry === expiry;
                    });
                    if (currentOptionMatches.length < 1) {
                        console.log("Greeks not found for: " + strike + "/" + type + "/" + expiry);
                    } else {
                        var currentOption = currentOptionMatches[0];
                        currentOption.delta = parseFloat($(cells[offset + 1]).text());
                        currentOption.gamma = parseFloat($(cells[offset + 2]).text());
                        currentOption.rho = parseFloat($(cells[offset + 3]).text());
                        currentOption.theta = parseFloat($(cells[offset + 4]).text());
                        currentOption.vega = parseFloat($(cells[offset + 5]).text());
                        currentOption.iv = parseFloat($(cells[offset + 6]).text());
                    }
                });
            });
        });
        callback(priceData);
    });
}

function addGreeks(priceData, ticker, callback) {
    var greeksUrl = "http://www.nasdaq.com/symbol/" + ticker + "/option-chain/greeks?dateindex=-1";
    request(greeksUrl)
        .then(function(body) {
            var $ = cheerio.load(body);
            var pages = $(".pagerlink").length - 1;
            getGreeksData(pages, priceData, ticker, greeksUrl, callback);
        });
}

function getPriceData(pages, ticker, pricesUrl, callback) {
    var pagePromises = [];
    for (var page = 1; page <= pages; page++) {
        pagePromises.push(request(pricesUrl + "&page=" + page).promise());
    }
    Promise.all(pagePromises).then(function(pageBodies) {
        var priceData = [];
        pageBodies.map(function(body) {
            var $ = cheerio.load(body);
            $(".OptionsChain-chart tr").slice(1).each(function() {
                var cells = $(this).children();
                $(this).attr('class') !== "groupheader" && [0, 9].forEach(function(offset) {
                    priceData.push({
                        scrapeDate: Date.now(),
                        ticker: ticker,
                        type: offset === 0 ? "call" : "put",
                        expiry: $(cells[offset]).text(),
                        last: parseFloat($(cells[offset + 1]).text()),
                        change: parseFloat($(cells[offset + 2]).text()),
                        bid: parseFloat($(cells[offset + 3]).text()),
                        ask: parseFloat($(cells[offset + 4]).text()),
                        vol: parseInt($(cells[offset + 5]).text()),
                        openInterest: parseInt($(cells[offset + 6]).text()),
                        strike: parseFloat($(cells[8]).text())
                    });
                });
            });
        });
        addGreeks(priceData, ticker, callback)
    });
}

function scrapeData(ticker, callback) {
    var pricesUrl = "http://www.nasdaq.com/symbol/" + ticker + "/option-chain?dateindex=-1"
    request(pricesUrl)
        .then(function(body) {
            var $ = cheerio.load(body);
            var pages = $(".pagerlink").length - 1;
            getPriceData(pages, ticker, pricesUrl, callback);
        });
}


/**
 * Usage
 * ------
 * scrapeData(ticker, callback)
 * where ticker is a string-type stock ticker symbol
 * and callback is a function that accepts one argument,
 * the data returned from scraping.
 * The data passed to callback will be an array of JS objects
 * with the following keys:
 *
 * scrapeDate: JS Date of the scrape-time
 * type: "call" or "put"
 * expiry: option expiry date, *as a human-readable string*
 * last: last sale, i.e. most recent trade
 * change: difference between day's last sale and the previous day's last sale
 * bid: bid
 * ask: ask
 * vol: volume
 * openInterest: Open Interest
 * strike: strike price
 * ticker: ticker symbol (same as argument) of underlying
 * delta: delta
 * gamma: gamma
 * rho: rho
 * theta: theta
 * vega: vega
 * iv: Implied Vol
 *
 * Example:
 * --------
 */

scrapeData("aapl", function(data) {
    console.log(data);
    // Or, save to DB here, or display, or whatever
});
