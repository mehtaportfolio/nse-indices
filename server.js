const express = require("express");
const cors = require("cors");
const cron = require("node-cron");
const { exec } = require("child_process");

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for front-end
app.use(cors({
  origin: process.env.FRONTEND_URL || "*",
  methods: ["GET", "POST"]
}));

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// Manual trigger endpoint (POST)
app.post("/restart", (req, res) => {
  exec("node updateIndices.js", (err, stdout, stderr) => {
    if (err) return res.status(500).json({ message: err.message });
    if (stderr) console.warn("⚠ WARN:", stderr);
    return res.json({ message: "Indices script executed", output: stdout });
  });
});

// Manual trigger endpoint (GET) for cron-job.org
app.get("/trigger", (req, res) => {
  if (isMarketOpen()) {
    runJobWithRetry();
    return res.json({ message: "Manual trigger: Indices job started" });
  } else {
    return res.json({ message: "Manual trigger: Market is CLOSED" });
  }
});

// Run job immediately after server starts (5s delay)
setTimeout(() => {
  if (isMarketOpen()) {
    console.log("🚀 Starting initial job (Market is OPEN)");
    runJobWithRetry();
  } else {
    console.log("😴 Skipping initial job (Market is CLOSED)");
  }
}, 5000);

// Schedule every 5 minutes
cron.schedule("*/5 * * * *", () => {
  console.log("⏳ Cron triggered at:", new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  if (isMarketOpen()) {
    runJobWithRetry();
  } else {
    console.log("⏸ Skipping: Market is CLOSED");
  }
});

// Market Hours Check (IST: 9:15 AM - 3:30 PM, Mon-Fri)
function isMarketOpen() {
  return true; // Bypass for testing
}

// Retry-enabled job execution
function runJobWithRetry(retries = 3) {
  exec("node updateIndices.js", (err, stdout, stderr) => {
    if (err) {
      console.error("❌ ERROR:", err.message);
      if (retries > 0) {
        console.log(`🔁 Retrying... (${retries} left)`);
        return setTimeout(() => runJobWithRetry(retries - 1), 5000);
      }
      return;
    }

    if (stderr) console.warn("⚠ WARN:", stderr);
    console.log("📌 OUTPUT:\n", stdout);
  });
}

// Start server
app.listen(PORT, () => {
  console.log(`🌐 Server listening on port ${PORT}`);
});
