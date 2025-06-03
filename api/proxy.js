const axios = require("axios");

// Environment variables
const PINATA_JWT = process.env.PINATA_JWT;

// Simple CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers":
    "X-Requested-With, Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

// Fallback gateways to try if primary fails
const fallbackGateways = [
  "https://ipfs.io",
  "https://dweb.link",
  "https://nftstorage.link",
  "https://web3.storage",
  "https://fleek.ipfs.io",
];

module.exports = async (req, res) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    Object.entries(corsHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    return res.status(200).end();
  }

  try {
    // Set CORS headers
    Object.entries(corsHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    // Extract IPFS hash from query parameters
    const { hash, path, ...otherParams } = req.query;

    if (!hash) {
      return res.status(400).json({
        error: "Bad Request",
        message: "IPFS hash is required. Use ?hash=<ipfs_hash> parameter.",
      });
    }

    // Clean the hash and extract just the hash part (before any path)
    let cleanHash = hash.replace(/^ipfs\//, "").replace(/^\//, "");
    let filePath = "";

    // If there's a path in the hash parameter, split it
    const hashParts = cleanHash.split("/");
    if (hashParts.length > 1) {
      cleanHash = hashParts[0];
      filePath = "/" + hashParts.slice(1).join("/");
    }

    // Use the path parameter if provided, otherwise use the extracted path
    const finalPath = path || filePath;

    // Basic hash validation (now only validates the hash part)
    if (!cleanHash.match(/^Qm[1-9A-HJ-NP-Za-km-z]{44}$|^bafy[a-z2-7]{55}$/)) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Invalid IPFS hash format",
      });
    }

    // Build URLs to try
    const urlsToTry = [];

    // Try dedicated gateway first if configured
    if (process.env.PINATA_GATEWAY_DOMAIN) {
      let dedicatedUrl = `https://${
        process.env.PINATA_GATEWAY_DOMAIN
      }/ipfs/${cleanHash}${finalPath || ""}`;
      if (Object.keys(otherParams).length > 0) {
        dedicatedUrl += `?${new URLSearchParams(otherParams).toString()}`;
      }
      urlsToTry.push({ url: dedicatedUrl, useAuth: true });
    }

    // Add fallback gateways
    fallbackGateways.forEach((gateway) => {
      let fallbackUrl = `${gateway}/ipfs/${cleanHash}${finalPath || ""}`;
      if (Object.keys(otherParams).length > 0) {
        fallbackUrl += `?${new URLSearchParams(otherParams).toString()}`;
      }
      urlsToTry.push({ url: fallbackUrl, useAuth: false });
    });

    // Try each URL until one works
    for (const { url, useAuth } of urlsToTry) {
      try {
        console.log(`Trying: ${url}`);

        const headers = {
          "User-Agent": "Mozilla/5.0 (compatible; IPFS-Proxy/1.0)",
          // Forward original request headers
          ...(req.headers["range"] && { Range: req.headers["range"] }),
          ...(req.headers["if-none-match"] && {
            "If-None-Match": req.headers["if-none-match"],
          }),
          ...(req.headers["if-modified-since"] && {
            "If-Modified-Since": req.headers["if-modified-since"],
          }),
        };

        // Add auth for dedicated gateway
        if (useAuth && PINATA_JWT) {
          headers["Authorization"] = `Bearer ${PINATA_JWT}`;
        }

        const response = await axios({
          method: req.method,
          url: url,
          headers: headers,
          responseType: "stream",
          validateStatus: () => true, // Don't throw on any status
          timeout: 30000,
        });

        // If successful, pipe the response directly
        if (response.status >= 200 && response.status < 400) {
          console.log(`Success from: ${url}`);

          // Set status
          res.status(response.status);

          // Forward all response headers
          Object.entries(response.headers).forEach(([key, value]) => {
            if (key.toLowerCase() !== "transfer-encoding") {
              // Skip transfer-encoding
              res.setHeader(key, value);
            }
          });

          // Pipe the response directly
          response.data.pipe(res);
          return;
        }

        console.log(`Failed with status ${response.status}: ${url}`);
      } catch (error) {
        console.log(`Error from ${url}: ${error.message}`);
        continue;
      }
    }

    // If we get here, all gateways failed
    return res.status(503).json({
      error: "Service Unavailable",
      message: "Content not available from any gateway",
      hash: cleanHash,
    });
  } catch (error) {
    console.error("Proxy error:", error.message);
    return res.status(500).json({
      error: "Internal Server Error",
      message: "An unexpected error occurred",
    });
  }
};
