const axios = require("axios");

// Environment variables validation
const PINATA_JWT = process.env.PINATA_JWT;

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

  return true;
}

// Helper function to build image optimization URL
function buildImageOptimizationUrl(hash, options = {}) {
  const {
    width,
    height,
    dpr = 1,
    fit = "contain",
    gravity,
    quality = 85,
    format = "auto",
    animation = true,
    sharpen,
    onError,
    metadata = "copyright",
  } = options;

  // Use the dedicated gateway if configured, fallback to public
  const gatewayUrl = process.env.PINATA_GATEWAY_DOMAIN
    ? `https://${process.env.PINATA_GATEWAY_DOMAIN}`
    : "https://gateway.pinata.cloud";

  // Use the correct Pinata files endpoint for image optimization
  let url = `${gatewayUrl}/files/${hash}`;
  const params = new URLSearchParams();

  // Add image optimization parameters with img- prefix
  if (width) params.append("img-width", width.toString());
  if (height) params.append("img-height", height.toString());
  if (dpr !== 1) params.append("img-dpr", dpr.toString());
  if (fit !== "contain") params.append("img-fit", fit);
  if (gravity) params.append("img-gravity", gravity);
  if (quality !== 85) params.append("img-quality", quality.toString());
  if (format !== "auto") params.append("img-format", format);
  if (!animation) params.append("img-anim", "false");
  if (sharpen) params.append("img-sharpen", sharpen.toString());
  if (onError) params.append("img-onerror", onError);
  if (metadata !== "copyright") params.append("img-metadata", metadata);

  if (params.toString()) {
    url += `?${params.toString()}`;
  }

  return url;
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

    // Extract parameters
    const { hash, ...options } = req.query;

    if (!hash) {
      return res.status(400).json({
        error: "Bad Request",
        message: "IPFS hash is required. Use ?hash=<ipfs_hash> parameter.",
        example: "/api/image?hash=QmYourHash&width=500&height=300&format=webp",
      });
    }

    // Clean the hash (remove any prefixes like 'ipfs/')
    const cleanHash = hash.replace(/^ipfs\//, "").replace(/^\//, "");

    // Validate IPFS hash format (basic validation)
    if (!cleanHash.match(/^Qm[1-9A-HJ-NP-Za-km-z]{44}$|^bafy[a-z2-7]{55}$/)) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Invalid IPFS hash format",
      });
    }

    // Validate image optimization parameters
    const validatedOptions = {};

    // Validate and convert numeric parameters
    ["width", "height", "dpr", "quality", "sharpen"].forEach((param) => {
      if (options[param]) {
        const value = parseFloat(options[param]);
        if (isNaN(value) || value <= 0) {
          return res.status(400).json({
            error: "Bad Request",
            message: `Invalid ${param} value: must be a positive number`,
          });
        }

        // Additional validation
        if (param === "quality" && (value < 1 || value > 100)) {
          return res.status(400).json({
            error: "Bad Request",
            message: "Quality must be between 1 and 100",
          });
        }

        if (param === "sharpen" && (value < 0 || value > 10)) {
          return res.status(400).json({
            error: "Bad Request",
            message: "Sharpen must be between 0 and 10",
          });
        }

        validatedOptions[param] = value;
      }
    });

    // Validate string parameters
    if (options.fit) {
      const validFitValues = ["scale-down", "contain", "cover", "crop", "pad"];
      if (!validFitValues.includes(options.fit)) {
        return res.status(400).json({
          error: "Bad Request",
          message: `Invalid fit value. Must be one of: ${validFitValues.join(
            ", "
          )}`,
        });
      }
      validatedOptions.fit = options.fit;
    }

    if (options.format) {
      const validFormatValues = ["auto", "webp", "avif", "jpeg", "png"];
      if (!validFormatValues.includes(options.format)) {
        return res.status(400).json({
          error: "Bad Request",
          message: `Invalid format value. Must be one of: ${validFormatValues.join(
            ", "
          )}`,
        });
      }
      validatedOptions.format = options.format;
    }

    if (options.metadata) {
      const validMetadataValues = ["keep", "copyright", "none"];
      if (!validMetadataValues.includes(options.metadata)) {
        return res.status(400).json({
          error: "Bad Request",
          message: `Invalid metadata value. Must be one of: ${validMetadataValues.join(
            ", "
          )}`,
        });
      }
      validatedOptions.metadata = options.metadata;
    }

    if (options.onError) {
      const validOnErrorValues = ["redirect"];
      if (!validOnErrorValues.includes(options.onError)) {
        return res.status(400).json({
          error: "Bad Request",
          message: `Invalid onError value. Must be one of: ${validOnErrorValues.join(
            ", "
          )}`,
        });
      }
      validatedOptions.onError = options.onError;
    }

    // Handle boolean parameters
    if (options.animation !== undefined) {
      validatedOptions.animation =
        options.animation === "true" || options.animation === "1";
    }

    // Pass through other valid parameters
    ["gravity"].forEach((param) => {
      if (options[param]) {
        validatedOptions[param] = options[param];
      }
    });

    // Build the optimized image URL
    const imageUrl = buildImageOptimizationUrl(cleanHash, validatedOptions);

    console.log(`Fetching optimized image from: ${imageUrl}`);

    // Fallback gateways for when dedicated gateway doesn't have the content
    const fallbackGateways = [
      "https://ipfs.io",
      "https://dweb.link",
      "https://gateway.pinata.cloud",
    ];

    // Function to try fallback gateways (without image optimization)
    const tryFallbackGateways = async () => {
      for (const fallbackGateway of fallbackGateways) {
        try {
          console.log(
            `Trying fallback gateway for original image: ${fallbackGateway}`
          );

          // Construct fallback URL using /ipfs/ endpoint (no image optimization)
          const fallbackUrl = `${fallbackGateway}/ipfs/${cleanHash}`;

          const fallbackResponse = await axios({
            method: "GET",
            url: fallbackUrl,
            headers: {
              "User-Agent": "IPFS-Reverse-Proxy-Image/1.0.0",
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
              `Successfully found original image on fallback gateway: ${fallbackGateway}`
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

    // Make request to Pinata gateway
    const response = await axios({
      method: "GET",
      url: imageUrl,
      headers: {
        ...(process.env.PINATA_GATEWAY_DOMAIN &&
          PINATA_JWT && {
            Authorization: `Bearer ${PINATA_JWT}`,
          }),
        "User-Agent": "IPFS-Reverse-Proxy-Image/1.0.0",
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
      timeout: 25000, // 25 second timeout
    });

    // If we got a 404 and we're using a dedicated gateway, try fallbacks
    let finalResponse = response;
    if (response.status === 404 && process.env.PINATA_GATEWAY_DOMAIN) {
      console.log(
        `Optimized image not found on dedicated gateway, trying fallbacks for original image...`
      );
      const fallbackResponse = await tryFallbackGateways();

      if (fallbackResponse) {
        finalResponse = fallbackResponse;
        // Add a header to indicate this is a fallback without optimization
        res.setHeader("X-Fallback-Gateway", "true");
        res.setHeader("X-Image-Optimization", "unavailable");
      }
    }

    // Forward status code
    res.status(finalResponse.status);

    // If the response is not successful, handle it as an error
    if (finalResponse.status >= 400) {
      // For error responses, try to parse as JSON if possible
      try {
        // For stream responses with errors, we need to read the stream
        const chunks = [];
        finalResponse.data.on("data", (chunk) => chunks.push(chunk));
        await new Promise((resolve, reject) => {
          finalResponse.data.on("end", resolve);
          finalResponse.data.on("error", reject);
        });
        const errorText = Buffer.concat(chunks).toString();

        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText || finalResponse.statusText };
        }

        return res.json({
          error: "Gateway Error",
          message:
            errorData.message ||
            finalResponse.statusText ||
            "Error from gateway",
          status: finalResponse.status,
          details: errorData,
        });
      } catch (parseError) {
        return res.json({
          error: "Gateway Error",
          message: finalResponse.statusText || "Error from gateway",
          status: finalResponse.status,
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
      if (finalResponse.headers[header]) {
        res.setHeader(header, finalResponse.headers[header]);
      }
    });

    // Set optimized caching headers for images
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

    // Only pipe successful responses
    if (finalResponse.data && typeof finalResponse.data.pipe === "function") {
      finalResponse.data.pipe(res);
    } else {
      // For non-stream responses (shouldn't happen with successful requests, but safety check)
      res.send(finalResponse.data);
    }
  } catch (error) {
    console.error("Image optimization error:", error.message);

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
