const axios = require("axios");

// Environment variables
const PINATA_JWT = process.env.PINATA_JWT;
const PINATA_GATEWAY_KEY = process.env.PINATA_GATEWAY_KEY;

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
    const { hash, ...otherParams } = req.query;

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

    // Basic hash validation (now only validates the hash part)
    if (!cleanHash.match(/^Qm[1-9A-HJ-NP-Za-km-z]{44}$|^bafy[a-z2-7]{55}$/)) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Invalid IPFS hash format",
      });
    }

    // Debug logging
    console.log(`Image request - Hash: ${cleanHash}, Path: ${filePath}`);
    console.log(`Optimization params:`, otherParams);
    console.log(
      `Pinata gateway configured: ${!!process.env.PINATA_GATEWAY_DOMAIN}`
    );
    console.log(`Pinata JWT available: ${!!PINATA_JWT}`);
    console.log(`Pinata Gateway Key available: ${!!PINATA_GATEWAY_KEY}`);
    if (process.env.PINATA_GATEWAY_DOMAIN) {
      console.log(`Using Pinata gateway: ${process.env.PINATA_GATEWAY_DOMAIN}`);
    }

    // Build URLs to try
    const urlsToTry = [];

    // For image optimization, we need Pinata's dedicated gateway
    if (process.env.PINATA_GATEWAY_DOMAIN) {
      let dedicatedUrl = `https://${process.env.PINATA_GATEWAY_DOMAIN}/ipfs/${cleanHash}${filePath}`;

      // Map parameters to Pinata's image optimization format
      const pinataParams = {};
      Object.entries(otherParams).forEach(([key, value]) => {
        switch (key) {
          case "width":
            pinataParams["img-width"] = value;
            break;
          case "height":
            pinataParams["img-height"] = value;
            break;
          case "format":
            pinataParams["img-format"] = value;
            break;
          case "quality":
            pinataParams["img-quality"] = value;
            break;
          case "dpr":
            pinataParams["img-dpr"] = value;
            break;
          case "fit":
            pinataParams["img-fit"] = value;
            break;
          case "gravity":
            pinataParams["img-gravity"] = value;
            break;
          case "animation":
            pinataParams["img-anim"] = value;
            break;
          case "sharpen":
            pinataParams["img-sharpen"] = value;
            break;
          case "metadata":
            pinataParams["img-metadata"] = value;
            break;
          default:
            // Pass through any img-* parameters as-is
            if (key.startsWith("img-")) {
              pinataParams[key] = value;
            }
        }
      });

      if (Object.keys(pinataParams).length > 0) {
        dedicatedUrl += `?${new URLSearchParams(pinataParams).toString()}`;
      }

      // Add Pinata Gateway Key as query parameter if available
      if (process.env.PINATA_GATEWAY_KEY) {
        const separator = Object.keys(pinataParams).length > 0 ? "&" : "?";
        dedicatedUrl += `${separator}pinataGatewayToken=${process.env.PINATA_GATEWAY_KEY}`;
      }

      urlsToTry.push({ url: dedicatedUrl, useAuth: true });
    } else if (Object.keys(otherParams).length > 0) {
      // If image optimization parameters are provided but no Pinata gateway is configured
      return res.status(400).json({
        error: "Bad Request",
        message:
          "Image optimization parameters require a configured Pinata gateway. Please set PINATA_GATEWAY_DOMAIN environment variable.",
        providedParams: Object.keys(otherParams),
      });
    }

    // Only add fallback gateways if no optimization parameters are provided
    if (Object.keys(otherParams).length === 0) {
      fallbackGateways.forEach((gateway) => {
        let fallbackUrl = `${gateway}/ipfs/${cleanHash}${filePath}`;
        urlsToTry.push({ url: fallbackUrl, useAuth: false });
      });
    }

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
        if (useAuth && PINATA_GATEWAY_KEY) {
          headers["x-pinata-gateway-token"] = PINATA_GATEWAY_KEY;
          console.log(`Adding Pinata Gateway Key auth`);
        } else if (useAuth && PINATA_JWT) {
          headers["Authorization"] = `Bearer ${PINATA_JWT}`;
          console.log(`Adding JWT auth for Pinata gateway`);
        } else if (useAuth) {
          console.log(
            `WARNING: useAuth=true but no PINATA_GATEWAY_KEY or PINATA_JWT available`
          );
        }

        console.log(`Request headers:`, {
          ...headers,
          Authorization: headers.Authorization ? "Bearer [HIDDEN]" : "NOT_SET",
          "x-pinata-gateway-token": headers["x-pinata-gateway-token"]
            ? "[HIDDEN]"
            : "NOT_SET",
        });

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
    console.error("Image proxy error:", error.message);
    return res.status(500).json({
      error: "Internal Server Error",
      message: "An unexpected error occurred",
    });
  }
};
