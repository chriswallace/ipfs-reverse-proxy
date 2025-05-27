const axios = require("axios");

// Environment variables validation
const PINATA_JWT = process.env.PINATA_JWT;
const API_KEY = process.env.API_KEY; // Optional - not used for public image serving

// Define allowed origins for wallacemuseum.com and local development
const ALLOWED_ORIGINS = [
  "https://wallacemuseum.com",
  "https://www.wallacemuseum.com",
  "http://localhost:5173",
  "https://localhost:5173",
  "https://ipfs.wallacemuseum.com",
];

if (!PINATA_JWT) {
  console.error("PINATA_JWT environment variable is required");
}

// API_KEY is optional for public image serving
if (API_KEY) {
  console.log("API_KEY provided but not required for public image serving");
}

// CORS headers - will be dynamically set based on origin
const getCorsHeaders = (origin) => {
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : "null";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers":
      "X-Requested-With, Content-Type, Authorization, X-API-Key",
    "Access-Control-Max-Age": "86400",
    "Access-Control-Allow-Credentials": "true",
  };
};

// Authentication middleware
function authenticateRequest(req) {
  // Get the origin from the request
  const origin = req.headers.origin || req.headers.referer;
  const userAgent = req.headers["user-agent"] || "";

  // If origin is provided, validate it
  if (origin) {
    try {
      const originUrl = new URL(origin);
      const isAllowedOrigin = ALLOWED_ORIGINS.some((allowedOrigin) => {
        const allowedUrl = new URL(allowedOrigin);
        return originUrl.hostname === allowedUrl.hostname;
      });

      if (!isAllowedOrigin) {
        console.log(`Blocked request from unauthorized origin: ${origin}`);
        return false;
      }
    } catch (error) {
      console.log(`Blocked request: Invalid origin format: ${origin}`);
      return false;
    }
  } else {
    // No origin header - check if it's a browser request for images
    const isBrowserRequest =
      userAgent.includes("Mozilla") ||
      userAgent.includes("Chrome") ||
      userAgent.includes("Safari") ||
      userAgent.includes("Firefox") ||
      userAgent.includes("Edge");

    // Allow browser requests (for img tags, direct navigation)
    // Block obvious programmatic requests (curl, wget, etc.)
    if (!isBrowserRequest && !userAgent.includes("bot")) {
      console.log(`Blocked non-browser request without origin: ${userAgent}`);
      return false;
    }
  }

  // No API key required for public image serving
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
    const corsHeaders = getCorsHeaders(
      req.headers.origin || req.headers.referer
    );
    Object.entries(corsHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    // Authenticate the request
    if (!authenticateRequest(req)) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Access denied: Origin not allowed",
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
