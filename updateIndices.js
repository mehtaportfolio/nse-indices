const { google } = require("googleapis");
const axios = require("axios");
require("dotenv").config();

console.log("⏳ NSE Index Updater (Compact NSE) Loaded...");

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
  const API_URL = "https://www.nseindia.com/api/allIndices";

  const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Referer": "https://www.nseindia.com/market-data/live-market-indices",
    "X-Requested-With": "XMLHttpRequest",
  };

  try {
    console.log("📡 Fetching Index Data from NSE API...");

    const res = await axios.get(API_URL, {
      headers: HEADERS,
      timeout: 10000,
    });

    if (!res.data || !res.data.data) {
      throw new Error("Invalid API response format");
    }

    const output = {};

    for (const [display, api] of Object.entries(INDEX_MAP)) {
      const data = res.data.data.find((d) => d.indexSymbol === api);
      output[display] = data
        ? { cmp: data.last, lcp: data.previousClose }
        : { cmp: null, lcp: null };
    }

    console.log("📦 Data fetched successfully.");
    return output;
  } catch (err) {
    console.error("❌ Error fetching NSE:", err.message);
    if (err.response) {
      console.error("Status Code:", err.response.status);
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
(async () => {
  const data = await fetchIndices();
  await updateSheet(data);
})();
