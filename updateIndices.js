require("dotenv").config();
const { google } = require("googleapis");
const axios = require("axios");
const { wrapper } = require("axios-cookiejar-support");
const { CookieJar } = require("tough-cookie");

console.log("⏳ NSE Index Updater (Lightweight NSE) Loaded...");

// Allowed symbols
const INDEX_MAP = {
  "NIFTY MIDCAP 100": "NIFTY MIDCAP 100",
  "NIFTY SMALLCAP 250": "NIFTY SMLCAP 250",
};

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GS_CLIENT_EMAIL,
    private_key: process.env.GS_PRIVATE_KEY.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });

// ------- Fetch NSE ------
async function fetchIndices() {
  const jar = new CookieJar();
  const client = wrapper(axios.create({ jar }));

  const BASE_URL = "https://www.nseindia.com";
  const MARKET_PAGE = "https://www.nseindia.com/market-data/live-market-indices";
  const API_URL = "https://www.nseindia.com/api/allIndices";

  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Host": "www.nseindia.com",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1"
  };

  try {
    console.log("📡 Initializing session with NSE...");

    // 1. Visit homepage to get initial cookies
    await client.get(BASE_URL, { headers });
    console.log("✅ Homepage visited.");

    // 2. Visit market page to solidify session
    await client.get(MARKET_PAGE, {
      headers: {
        ...headers,
        Referer: BASE_URL,
        "Sec-Fetch-Site": "same-origin",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Dest": "document"
      },
    });
    console.log("✅ Market page visited. Waiting 2s...");
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 3. Fetch API with full cookie jar
    const res = await client.get(API_URL, {
      headers: {
        ...headers,
        Referer: MARKET_PAGE,
        "Sec-Fetch-Site": "same-origin",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Dest": "empty"
      },
    });

    const output = {};

    for (const [display, api] of Object.entries(INDEX_MAP)) {
      const data = res.data.data.find((d) => d.indexSymbol === api);
      output[display] = data
        ? { cmp: data.last, lcp: data.previousClose }
        : { cmp: null, lcp: null };
    }

    console.log("📦 Data fetched successfully.");
    console.log("📊 Fetched Values:", JSON.stringify(output, null, 2));
    return output;
  } catch (err) {
    console.error("❌ Error fetching NSE:", err.message);
    if (err.response) {
      console.error("Status:", err.response.status);
    }
    return {};
  }
}

// ------- Update Sheet -------
async function updateSheet(indexData) {
  const SHEET_ID = process.env.GOOGLE_SHEET_ID;
  const SHEET_NAME = "Stocks";

  console.log("📄 Reading Sheet...");

  // Get sheet meta to find sheetId
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: SHEET_ID,
  });

  const sheetInfo = meta.data.sheets.find(
    (s) => s.properties.title === SHEET_NAME
  );

  if (!sheetInfo) {
    console.log("❌ Sheet not found.");
    return;
  }

  const sheetId = sheetInfo.properties.sheetId;

  // Get existing rows
  const getRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A1:Z200`,
  });

  const rows = getRes.data.values || [];
  const headers = rows[0]?.map(h => h.toLowerCase().trim()) || [];

  const symbolCol = headers.indexOf("symbol");
  const cmpCol = headers.indexOf("cmp");
  const lcpCol = headers.indexOf("lcp");

  if (symbolCol === -1 || cmpCol === -1 || lcpCol === -1) {
    console.log("❌ Missing required headers (symbol, cmp, or lcp) in row 1.");
    console.log("Current headers found:", rows[0]);
    return;
  }

  const requests = [];

  rows.forEach((row, rowIndex) => {
    if (rowIndex === 0) return;

    const symbol = row[symbolCol]?.trim().toUpperCase();

    if (indexData[symbol]) {
      console.log(`🔧 Match found! Updating ${symbol} at row ${rowIndex + 1}`);
      console.log(`📈 New Values: CMP=${indexData[symbol].cmp}, LCP=${indexData[symbol].lcp}`);

      requests.push({
        updateCells: {
          range: {
            sheetId,
            startRowIndex: rowIndex,
            endRowIndex: rowIndex + 1,
            startColumnIndex: cmpCol,
            endColumnIndex: cmpCol + 1,
          },
          rows: [
            {
              values: [{ userEnteredValue: { numberValue: indexData[symbol].cmp } }],
            },
          ],
          fields: "userEnteredValue",
        },
      });

      requests.push({
        updateCells: {
          range: {
            sheetId,
            startRowIndex: rowIndex,
            endRowIndex: rowIndex + 1,
            startColumnIndex: lcpCol,
            endColumnIndex: lcpCol + 1,
          },
          rows: [
            {
              values: [{ userEnteredValue: { numberValue: indexData[symbol].lcp } }],
            },
          ],
          fields: "userEnteredValue",
        },
      });
    }
  });

  if (requests.length === 0) return console.log("⚠ No matching rows found.");

  console.log("✍ Updating Google Sheet...");

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: { requests },
  });

  console.log("✅ Sheet Update Complete.");
}

// ------- RUN ------
async function runJob() {
  try {
    console.log("🚀 Running NSE update job...");

    const data = await fetchIndices();
    await updateSheet(data);

    console.log("✅ Job completed.\n");
  } catch (err) {
    console.error("❌ Job failed:", err.message);
  }
}

// Run immediately
runJob();