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

// Manual trigger endpoint
app.post("/restart", (req, res) => {
  exec("node updateIndices.js", (err, stdout, stderr) => {
    if (err) return res.status(500).json({ message: err.message });
    if (stderr) console.warn("⚠ WARN:", stderr);
    return res.json({ message: "Indices script executed", output: stdout });
  });
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

// Schedule every 15 minutes
cron.schedule("*/15 * * * *", () => {
  console.log("⏳ Cron triggered at:", new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  if (isMarketOpen()) {
    runJobWithRetry();
  } else {
    console.log("⏸ Skipping: Market is CLOSED");
  }
});

// Market Hours Check (IST: 9:15 AM - 3:30 PM, Mon-Fri)
function isMarketOpen() {
  const now = new Date();
  const istTime = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
    weekday: "long",
  }).formatToParts(now);

  const parts = {};
  istTime.forEach(({ type, value }) => (parts[type] = value));

  const day = parts.weekday;
  const hour = parseInt(parts.hour);
  const minute = parseInt(parts.minute);

  const isWeekday = !["Saturday", "Sunday"].includes(day);
  const totalMinutes = hour * 60 + minute;
  const startMinutes = 9 * 60 + 15; // 09:15
  const endMinutes = 15 * 60 + 30;  // 15:30

  return isWeekday && totalMinutes >= startMinutes && totalMinutes <= endMinutes;
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
