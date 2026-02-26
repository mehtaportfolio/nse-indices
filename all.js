const axios = require("axios");

(async () => {
  const res = await axios.get("https://www.nseindia.com/api/allIndices", {
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  console.log(res.data.data.map(d => d.indexSymbol));
})();
