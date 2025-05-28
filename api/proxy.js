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

// PINATA_JWT is only required when using a dedicated gateway
if (process.env.PINATA_GATEWAY_DOMAIN && !PINATA_JWT) {
  console.error(
    "PINATA_JWT environment variable is required when using a dedicated gateway"
  );
}

// API_KEY is optional for public image serving
if (API_KEY) {
  console.log("API_KEY provided but not required for public image serving");
}

// Image optimization parameter mapping
const IMAGE_OPTIMIZATION_PARAMS = {
  // Width and height
  width: "img-width",
  height: "img-height",
  "img-width": "img-width",
  "img-height": "img-height",

  // Device pixel ratio
  dpr: "img-dpr",
  "img-dpr": "img-dpr",

  // Fit modes
  fit: "img-fit",
  "img-fit": "img-fit",

  // Gravity/focus point
  gravity: "img-gravity",
  "img-gravity": "img-gravity",

  // Quality
  quality: "img-quality",
  "img-quality": "img-quality",

  // Format
  format: "img-format",
  "img-format": "img-format",

  // Animation
  anim: "img-anim",
  animation: "img-anim",
  "img-anim": "img-anim",

  // Sharpening
  sharpen: "img-sharpen",
  "img-sharpen": "img-sharpen",

  // Error handling
  onerror: "img-onerror",
  "img-onerror": "img-onerror",

  // Metadata
  metadata: "img-metadata",
  "img-metadata": "img-metadata",
};

// Helper function to process image optimization parameters
function processImageOptimizationParams(queryParams) {
  const imageParams = new URLSearchParams();
  const otherParams = new URLSearchParams();

  Object.entries(queryParams).forEach(([key, value]) => {
    // Skip our internal parameters
    if (["hash", "gateway", "path"].includes(key)) {
      return;
    }

    // Check if this is an image optimization parameter
    const mappedParam = IMAGE_OPTIMIZATION_PARAMS[key];
    if (mappedParam) {
      // Validate and transform the parameter value if needed
      let processedValue = value;

      // Validate fit parameter values
      if (mappedParam === "img-fit") {
        const validFitValues = [
          "scale-down",
          "contain",
          "cover",
          "crop",
          "pad",
        ];
        if (!validFitValues.includes(value)) {
          console.warn(`Invalid img-fit value: ${value}. Using default.`);
          return; // Skip invalid fit values
        }
      }

      // Validate format parameter values
      if (mappedParam === "img-format") {
        const validFormatValues = ["auto", "webp", "avif", "jpeg", "png"];
        if (!validFormatValues.includes(value)) {
          console.warn(`Invalid img-format value: ${value}. Using default.`);
          return; // Skip invalid format values
        }
      }

      // Validate metadata parameter values
      if (mappedParam === "img-metadata") {
        const validMetadataValues = ["keep", "copyright", "none"];
        if (!validMetadataValues.includes(value)) {
          console.warn(`Invalid img-metadata value: ${value}. Using default.`);
          return; // Skip invalid metadata values
        }
      }

      // Validate onerror parameter values
      if (mappedParam === "img-onerror") {
        const validOnErrorValues = ["redirect"];
        if (!validOnErrorValues.includes(value)) {
          console.warn(`Invalid img-onerror value: ${value}. Using default.`);
          return; // Skip invalid onerror values
        }
      }

      // Validate numeric parameters
      if (
        [
          "img-width",
          "img-height",
          "img-quality",
          "img-dpr",
          "img-sharpen",
        ].includes(mappedParam)
      ) {
        const numValue = parseFloat(value);
        if (isNaN(numValue) || numValue <= 0) {
          console.warn(`Invalid numeric value for ${mappedParam}: ${value}`);
          return; // Skip invalid numeric values
        }

        // Additional validation for specific parameters
        if (mappedParam === "img-quality" && (numValue < 1 || numValue > 100)) {
          console.warn(`img-quality must be between 1-100, got: ${value}`);
          return;
        }

        if (mappedParam === "img-sharpen" && (numValue < 0 || numValue > 10)) {
          console.warn(`img-sharpen must be between 0-10, got: ${value}`);
          return;
        }
      }

      imageParams.append(mappedParam, processedValue);
    } else {
      // Keep other parameters as-is
      otherParams.append(key, value);
    }
  });

  return { imageParams, otherParams };
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
    const { hash, gateway, path, ...otherParams } = req.query;
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

    // Process image optimization parameters and other query parameters
    const { imageParams, otherParams: processedOtherParams } =
      processImageOptimizationParams(otherParams);

    // Use the correct endpoint based on whether image optimization is requested
    const hasImageOptimization = imageParams.toString().length > 0;

    // Always use the dedicated gateway if configured, fallback to public
    const gatewayUrl = process.env.PINATA_GATEWAY_DOMAIN
      ? `https://${process.env.PINATA_GATEWAY_DOMAIN}`
      : "https://gateway.pinata.cloud";

    if (hasImageOptimization) {
      // Use /files/{cid} endpoint for image optimization
      pinataUrl = `${gatewayUrl}/files/${ipfsHash}`;

      // Note: path parameters are not supported with image optimization
      if (path) {
        console.warn(
          "Path parameters are not supported with image optimization, ignoring path:",
          path
        );
      }
    } else {
      // For regular content, use simple /ipfs/{hash}{path} approach
      // This handles directories, files, and nested paths correctly
      pinataUrl = `${gatewayUrl}/ipfs/${ipfsHash}${path || ""}`;
    }

    // Combine all query parameters
    const allParams = new URLSearchParams();

    // Add image optimization parameters first
    imageParams.forEach((value, key) => {
      allParams.append(key, value);
    });

    // Add other parameters
    processedOtherParams.forEach((value, key) => {
      allParams.append(key, value);
    });

    if (allParams.toString()) {
      pinataUrl += `?${allParams.toString()}`;
    }

    console.log(`Proxying request to: ${pinataUrl}`);

    // Log image optimization parameters if any are present
    if (imageParams.toString()) {
      console.log(`Image optimization parameters: ${imageParams.toString()}`);
    }

    // Fallback gateways to try if the dedicated gateway doesn't have the content
    const fallbackGateways = [
      "https://ipfs.io",
      "https://dweb.link",
      "https://gateway.pinata.cloud",
    ];

    // Function to make request to gateway
    const makeRequest = async (url, checkForHtmlRestriction = false) => {
      const headers = {
        "User-Agent": "IPFS-Reverse-Proxy/1.0.0",
        // Forward relevant headers from the original request
        ...(req.headers["range"] && { Range: req.headers["range"] }),
        ...(req.headers["if-none-match"] && {
          "If-None-Match": req.headers["if-none-match"],
        }),
        ...(req.headers["if-modified-since"] && {
          "If-Modified-Since": req.headers["if-modified-since"],
        }),
      };

      // Add Authorization header when using dedicated gateway (not for public gateway paths)
      const isUsingDedicatedGateway =
        process.env.PINATA_GATEWAY_DOMAIN &&
        url.includes(process.env.PINATA_GATEWAY_DOMAIN) &&
        !url.includes("gateway.pinata.cloud");

      if (isUsingDedicatedGateway && PINATA_JWT) {
        headers.Authorization = `Bearer ${PINATA_JWT}`;
      }

      return await axios({
        method: req.method,
        url: url,
        headers: headers,
        responseType: checkForHtmlRestriction ? "text" : "stream",
        validateStatus: (status) => status < 500, // Don't throw on 4xx errors
        timeout: 25000, // 25 second timeout (less than Vercel's 30s limit)
      });
    };

    // Function to try fallback gateways
    const tryFallbackGateways = async () => {
      // Only try fallbacks for regular content (not image optimization)
      if (hasImageOptimization) {
        return null; // Image optimization requires dedicated gateway
      }

      for (const fallbackGateway of fallbackGateways) {
        try {
          console.log(`Trying fallback gateway: ${fallbackGateway}`);

          // Construct fallback URL using /ipfs/ endpoint
          let fallbackUrl = `${fallbackGateway}/ipfs/${ipfsHash}${path || ""}`;

          // Add non-image-optimization parameters
          if (processedOtherParams.toString()) {
            fallbackUrl += `?${processedOtherParams.toString()}`;
          }

          // Make request without authentication (public gateways)
          const fallbackResponse = await axios({
            method: req.method,
            url: fallbackUrl,
            headers: {
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
            validateStatus: (status) => status < 500,
            timeout: 15000, // Shorter timeout for fallbacks
          });

          if (fallbackResponse.status === 200) {
            console.log(
              `Successfully found content on fallback gateway: ${fallbackGateway}`
            );
            return fallbackResponse;
          }
        } catch (error) {
          console.log(
            `Fallback gateway ${fallbackGateway} failed: ${error.message}`
          );
          continue; // Try next gateway
        }
      }

      return null; // No fallback succeeded
    };

    // Make request to primary gateway
    let response = await makeRequest(pinataUrl, true); // Check for HTML restriction first

    // If we got a 404 or 401 from the dedicated gateway, try fallback gateways
    if (
      (response.status === 404 || response.status === 401) &&
      process.env.PINATA_GATEWAY_DOMAIN
    ) {
      console.log(
        `Content not found or restricted on dedicated gateway (status: ${response.status}), trying fallbacks...`
      );
      const fallbackResponse = await tryFallbackGateways();

      if (fallbackResponse) {
        response = fallbackResponse;
      }
    }

    // If we got a text response (from checking for HTML restriction), make a proper stream request
    if (response.config.responseType === "text" && response.status === 200) {
      response = await makeRequest(pinataUrl); // Get the actual stream
    }

    // Forward status code
    res.status(response.status);

    // If the response is not successful, handle it as an error
    if (response.status >= 400) {
      // For error responses, try to parse as JSON if possible
      try {
        let errorData;
        if (response.config.responseType === "text") {
          // If it's text, try to parse as JSON
          try {
            errorData = JSON.parse(response.data);
          } catch {
            errorData = { message: response.data || response.statusText };
          }
        } else {
          // For stream responses with errors, we need to read the stream
          const chunks = [];
          response.data.on("data", (chunk) => chunks.push(chunk));
          await new Promise((resolve, reject) => {
            response.data.on("end", resolve);
            response.data.on("error", reject);
          });
          const errorText = Buffer.concat(chunks).toString();
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { message: errorText || response.statusText };
          }
        }

        return res.json({
          error: "Gateway Error",
          message:
            errorData.message || response.statusText || "Error from gateway",
          status: response.status,
          details: errorData,
        });
      } catch (parseError) {
        return res.json({
          error: "Gateway Error",
          message: response.statusText || "Error from gateway",
          status: response.status,
        });
      }
    }

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

    // Set additional caching headers for different content types
    const contentType = response.headers["content-type"];
    if (contentType) {
      if (
        contentType.startsWith("image/") ||
        contentType.startsWith("video/") ||
        contentType.startsWith("audio/") ||
        contentType.includes("application/pdf")
      ) {
        // Long cache for media files
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      } else if (
        contentType.includes("text/html") ||
        contentType.includes("application/javascript") ||
        contentType.includes("text/css") ||
        contentType.includes("application/json")
      ) {
        // Shorter cache for code/HTML content that might change
        res.setHeader("Cache-Control", "public, max-age=3600");
      }
    }

    // Only pipe successful responses
    if (response.data && typeof response.data.pipe === "function") {
      response.data.pipe(res);
    } else {
      // For non-stream responses (shouldn't happen with successful requests, but safety check)
      res.send(response.data);
    }
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
