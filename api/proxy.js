const axios = require("axios");

// Environment variables validation
const PINATA_JWT = process.env.PINATA_JWT;
const API_KEY = process.env.API_KEY;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : [];

if (!PINATA_JWT) {
  console.error("PINATA_JWT environment variable is required");
}

if (!API_KEY) {
  console.error("API_KEY environment variable is required");
}

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "X-Requested-With, Content-Type, Authorization, X-API-Key",
  "Access-Control-Max-Age": "86400",
};

// Authentication middleware
function authenticateRequest(req) {
  const apiKey =
    req.headers["x-api-key"] ||
    req.headers["authorization"]?.replace("Bearer ", "");

  if (!apiKey || apiKey !== API_KEY) {
    return false;
  }

  // Optional: Check origin if ALLOWED_ORIGINS is configured
  if (ALLOWED_ORIGINS.length > 0) {
    const origin = req.headers.origin || req.headers.referer;
    const isAllowedOrigin = ALLOWED_ORIGINS.some(
      (allowedOrigin) => origin && origin.includes(allowedOrigin)
    );

    if (!isAllowedOrigin) {
      return false;
    }
  }

  return true;
}

// Main handler function
module.exports = async (req, res) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return res.status(200).json({});
  }

  try {
    // Set CORS headers
    Object.entries(corsHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    // Authenticate the request
    if (!authenticateRequest(req)) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Invalid API key or origin not allowed",
      });
    }

    // Extract IPFS hash from query parameters or URL path
    const { hash, gateway } = req.query;
    let ipfsHash = hash;

    if (!ipfsHash) {
      return res.status(400).json({
        error: "Bad Request",
        message: "IPFS hash is required. Use ?hash=<ipfs_hash> parameter.",
      });
    }

    // Clean the hash (remove any prefixes like 'ipfs/')
    ipfsHash = ipfsHash.replace(/^ipfs\//, "").replace(/^\//, "");

    // Validate IPFS hash format (basic validation)
    if (!ipfsHash.match(/^Qm[1-9A-HJ-NP-Za-km-z]{44}$|^bafy[a-z2-7]{55}$/)) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Invalid IPFS hash format",
      });
    }

    // Determine the gateway to use
    const gatewayUrl =
      gateway === "dedicated"
        ? `https://${
            process.env.PINATA_GATEWAY_DOMAIN || "gateway.pinata.cloud"
          }`
        : "https://gateway.pinata.cloud";

    // Construct the Pinata gateway URL
    const pinataUrl = `${gatewayUrl}/ipfs/${ipfsHash}`;

    console.log(`Proxying request to: ${pinataUrl}`);

    // Make request to Pinata gateway
    const response = await axios({
      method: req.method,
      url: pinataUrl,
      headers: {
        Authorization: `Bearer ${PINATA_JWT}`,
        "User-Agent": "IPFS-Reverse-Proxy/1.0.0",
        // Forward relevant headers from the original request
        ...(req.headers["range"] && { Range: req.headers["range"] }),
        ...(req.headers["if-none-match"] && {
          "If-None-Match": req.headers["if-none-match"],
        }),
        ...(req.headers["if-modified-since"] && {
          "If-Modified-Since": req.headers["if-modified-since"],
        }),
      },
      responseType: "stream",
      validateStatus: (status) => status < 500, // Don't throw on 4xx errors
      timeout: 25000, // 25 second timeout (less than Vercel's 30s limit)
    });

    // Forward status code
    res.status(response.status);

    // Forward relevant headers from Pinata response
    const headersToForward = [
      "content-type",
      "content-length",
      "content-range",
      "accept-ranges",
      "etag",
      "last-modified",
      "cache-control",
      "expires",
    ];

    headersToForward.forEach((header) => {
      if (response.headers[header]) {
        res.setHeader(header, response.headers[header]);
      }
    });

    // Set additional caching headers for media files
    const contentType = response.headers["content-type"];
    if (
      contentType &&
      (contentType.startsWith("image/") ||
        contentType.startsWith("video/") ||
        contentType.startsWith("audio/") ||
        contentType.includes("application/pdf"))
    ) {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    }

    // Pipe the response
    response.data.pipe(res);
  } catch (error) {
    console.error("Proxy error:", error.message);

    // Handle specific error cases
    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
      return res.status(504).json({
        error: "Gateway Timeout",
        message: "Request to Pinata gateway timed out",
      });
    }

    if (error.response) {
      // Forward error from Pinata
      return res.status(error.response.status).json({
        error: "Gateway Error",
        message: error.response.statusText || "Error from Pinata gateway",
        status: error.response.status,
      });
    }

    // Generic server error
    return res.status(500).json({
      error: "Internal Server Error",
      message: "An unexpected error occurred",
    });
  }
};
