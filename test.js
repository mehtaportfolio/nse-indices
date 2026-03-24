const YahooFinance = require("yahoo-finance2").default;
const readline = require("readline");

const yahooFinance = new YahooFinance({
  suppressNotices: ['yahooSurvey']
});

console.log("⏳ NSE Stock Test Script Loaded...");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question("🔎 Enter NSE Stock Symbol: ", async (inputSymbol) => {
  try {
    const symbol = inputSymbol.trim().toUpperCase() + ".NS";

    console.log("📡 Fetching Stock Data...");

    const data = await yahooFinance.quote(symbol);

    if (!data) {
      console.log("❌ Invalid symbol.");
      rl.close();
      return;
    }

    const cmp = data.regularMarketPrice;
    const lcp = data.regularMarketPreviousClose;

    console.log("\n📊 Result");
    console.log("----------------------------");
    console.log(`Stock : ${symbol}`);
    console.log(`CMP   : ${cmp}`);
    console.log(`LCP   : ${lcp}`);
    console.log(`Change: ${(cmp - lcp).toFixed(2)}`);

  } catch (err) {
    console.log("❌ Error:", err.message);
  } finally {
    rl.close();
  }
});