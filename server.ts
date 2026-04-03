import express from "express";
import axios from "axios";
import cors from "cors";
import { WebSocketServer } from "ws";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";
//import https from "https";
import fs from "fs";
import path from 'path';


const app = express();
//app.use(cors());

const PORT = process.env.PORT || 10000;
const hostUrl = process.env.HOST_URL || `http://localhost:${PORT}`

const __dirnameAct = path.dirname(__dirname);

  console.log("Server starting eith __dirname  "+ __dirnameAct);

// Enable CORS for all routes
const corsOrigins = process.env.CORS_ORIGINS ? 
  process.env.CORS_ORIGINS.split(',').map(origin => origin.trim()) : 
  [];

const corsMethods = process.env.CORS_METHODS ? 
  process.env.CORS_METHODS.split(',').map(method => method.trim()) : 
  ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];

const corsHeaders = process.env.CORS_HEADERS ? 
  process.env.CORS_HEADERS.split(',').map(header => header.trim()) : 
  ['Content-Type', 'Authorization'];

app.use(cors({
  origin: [
    ...corsOrigins,
    /^http:\/\/localhost:\d+$/,  // Allow any localhost port
    /^http:\/\/127\.0\.0\.1:\d+$/ // Allow any 127.0.0.1 port
  ],
  methods: corsMethods,
  allowedHeaders: corsHeaders,
  credentials: process.env.CORS_CREDENTIALS !== 'true'
}));


// 🔐 STEP 1: LOAD SSL CERTIFICATES
//
/*const sslOptions = {
  key:fs.readFileSync('ssl-key/server.key', 'utf8'),   // 🔑 private key
  cert:fs.readFileSync('ssl-crt/server.crt', 'utf8'), // 📜 certificate
};
*/
//
// 🔐 STEP 2: CREATE HTTPS SERVER (THIS IS THE KNOT)
//
 
 
//const server = https.createServer(sslOptions, app);

// Cookie jar (important for NSE)
const jar = new CookieJar();
// ✅ Create axios FIRST
const axiosInstance = axios.create();

//const client = wrapper(axios.create({ jar }));

// ✅ Then wrap it
// ✅ wrap instance
const client = wrapper(axiosInstance as any); // 👈 important cast
// ✅ Attach jar AFTER

// ✅ assign cookie jar safely
(client.defaults as any).jar = jar;
client.defaults.withCredentials = true;

const baseHeaders = {
  "User-Agent": "Mozilla/5.0",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Connection": "keep-alive"
};

// Cache to reduce hits
let cachedData: any = null;
let lastFetchTime = 0;

// 🔁 INIT NSE SESSION
async function initSession() {
  try {
    await client.get("https://www.nseindia.com", {
      headers: baseHeaders
    });
  } catch (e) {
    console.log("NSE session init failed");
  }
}
async function fetchSensex() {
  try {
    /*const res = await axios.get(
      "https://query1.finance.yahoo.com/v7/finance/quote?symbols=^BSESN"
    );*/


      const res = await axios.get(
      "https://query1.finance.yahoo.com/v8/finance/chart/^BSESN?interval=2m&range=1d",
      {
        headers: {
          "User-Agent": "Mozilla/5.0"
        }
      }
    );
     const meta = res.data?.chart?.result?.[0]?.meta;



   // const quote = res.data?.quoteResponse?.result?.[0];
    let extrated = {"key":"INDICES ELIGIBLE IN DERIVATIVES","index":"SENSEX","indexSymbol":"SENSEX","last": meta?.regularMarketPrice,"variation":meta?.regularMarketPrice - meta?.previousClose,
  "percentChange": ((meta?.regularMarketPrice - meta?.previousClose) /
          meta?.previousClose) *
        100,"open":'',
"high":meta?.regularMarketDayHigh,"low":meta?.regularMarketDayLow,"previousClose":meta?.previousClose,"yearHigh":'',"yearLow":'',"indicativeClose":0,"pe":"19.96","pb":"3.1","dy":"1.37",
"declines":"26","advances":"24","unchanged":"0","perChange365d":-2.31,"perChange30d":-8.66,"date365dAgo":"26-Mar-2025","date30dAgo":"24-Feb-2026",
"previousDay":"27-Mar-2026","oneWeekAgo":"20-Mar-2026","oneMonthAgoVal":25424.65,"oneWeekAgoVal":23114.5,"oneYearAgoVal":23486.85,
"previousDayVal":22819.6,"chart365dPath":"","chart30dPath":"",
"chartTodayPath":""} 
    
    
    /*
{"key":"INDICES ELIGIBLE IN DERIVATIVES","index":"SENSEX","indexSymbol":"SENSEX","last":quote?.regularMarketPrice,"variation":quote?.regularMarketChange,
  "percentChange":'',"open":'',
"high":'',"low":'',"previousClose":'',"yearHigh":'',"yearLow":'',"indicativeClose":0,"pe":"19.96","pb":"3.1","dy":"1.37",
"declines":"26","advances":"24","unchanged":"0","perChange365d":-2.31,"perChange30d":-8.66,"date365dAgo":"26-Mar-2025","date30dAgo":"24-Feb-2026",
"previousDay":"27-Mar-2026","oneWeekAgo":"20-Mar-2026","oneMonthAgoVal":25424.65,"oneWeekAgoVal":23114.5,"oneYearAgoVal":23486.85,
"previousDayVal":22819.6,"chart365dPath":"","chart30dPath":"",
"chartTodayPath":""} */


    return extrated;


   /* return {
      name: "SENSEX",
      value: quote?.regularMarketPrice,
      change: quote?.regularMarketChange,
      percent: quote?.regularMarketChangePercent
    };*/
  } catch (err) {
    console.log("❌ Sensex fetch failed");
    return null;
  }
}
// 🔹 NSE FETCH
async function fetchNSE() {
  try {
    await initSession();

    const res = await client.get(
      "https://www.nseindia.com/api/allIndices",
      { headers: baseHeaders }
    );

    return res.data;
  } catch (err) {
    throw new Error("NSE_FAILED");
  }
}

// 🔹 YAHOO FALLBACK
async function fetchYahoo() {
  try {
    const res = await axios.get(
      "https://query1.finance.yahoo.com/v7/finance/quote?symbols=^NSEI,^NSEBANK,^BSESN"
    );

    return res.data;
  } catch (err) {
    throw new Error("YAHOO_FAILED");
  }
}

// 🔁 MASTER FETCH
async function getMarketData() {
  const now = Date.now();

  // cache 2 sec
  if (cachedData && now - lastFetchTime < 2000) {
    return cachedData;
  }

  try {
    const data = await fetchNSE();
    // filter only NIFTY 50 and NIFTY BANK

    const raw = data?.data || [];

    const filtered = raw.filter((item: any) =>
      item.index === "NIFTY 50" || item.index === "NIFTY BANK"
    );
    const sensex = await fetchSensex(); // 🔥 from Yahoo
      filtered.push(sensex);


    cachedData = { source: "NSE", data: filtered};
  } catch {
    console.log("⚠️ NSE failed, switching to Yahoo");

    try {
      const data = await fetchYahoo();
      cachedData = { source: "YAHOO", data };
    } catch {
      cachedData = { source: "NONE", data: null };
    }
  }

  lastFetchTime = now;
  return cachedData;
}

// REST endpoint
app.get("/api/market", async (req, res) => {
  const data = await getMarketData();
  res.json(data);
});


const server = app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
   // Log CORS configuration
        if (corsOrigins.length > 0) {
            console.log(`CORS Origins: ${corsOrigins.join(', ')}`);
        }
        console.log(`CORS Methods: ${corsMethods.join(', ')}`);
        console.log(`CORS Headers: ${corsHeaders.join(', ')}`);
        console.log(`CORS Credentials: ${process.env.CORS_CREDENTIALS !== undefined ? process.env.CORS_CREDENTIALS : false}`);


});

//
// 🔌 STEP 4: ATTACH WEBSOCKET TO SAME HTTPS SERVER
//
const wss = new WebSocketServer({ server });
// 🔌 WEBSOCKET
//const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
 // console.log("Client connected");
    console.log("✅ Secure WebSocket (WSS) connected");
  const interval = setInterval(async () => {
      try {
          const data = await getMarketData();
          ws.send(JSON.stringify(data));
      } catch {
           ws.send(JSON.stringify({ source: "NONE", data: null }));
    }
  }, 2000);

  ws.on("close", () => {
       console.log("❌ WSS disconnected");
    clearInterval(interval);
  });
});

//
// 🚀 STEP 5: START HTTPS SERVER
//
/*server.listen(PORT, () => {
  console.log(`🔐 HTTPS running → https://localhost:${PORT}`);
  console.log(`🔌 WSS running → wss://localhost:${PORT}`);
});*/


