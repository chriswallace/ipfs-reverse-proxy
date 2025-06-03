module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const { hash, ...otherParams } = req.query;

    // Clean the hash and extract just the hash part (before any path)
    let cleanHash = hash ? hash.replace(/^ipfs\//, "").replace(/^\//, "") : "";
    let filePath = "";

    if (cleanHash) {
      const hashParts = cleanHash.split("/");
      if (hashParts.length > 1) {
        cleanHash = hashParts[0];
        filePath = "/" + hashParts.slice(1).join("/");
      }
    }

    const debugInfo = {
      timestamp: new Date().toISOString(),
      environment: {
        PINATA_GATEWAY_DOMAIN: process.env.PINATA_GATEWAY_DOMAIN || "NOT_SET",
        PINATA_JWT: process.env.PINATA_JWT ? "SET (hidden)" : "NOT_SET",
        PINATA_GATEWAY_KEY: process.env.PINATA_GATEWAY_KEY
          ? "SET (hidden)"
          : "NOT_SET",
        NODE_ENV: process.env.NODE_ENV || "NOT_SET",
      },
      request: {
        method: req.method,
        url: req.url,
        query: req.query,
        headers: {
          "user-agent": req.headers["user-agent"],
          authorization: req.headers["authorization"]
            ? "SET (hidden)"
            : "NOT_SET",
        },
      },
      parsed: {
        originalHash: hash,
        cleanHash: cleanHash,
        filePath: filePath,
        otherParams: otherParams,
        hasOptimizationParams: Object.keys(otherParams).length > 0,
      },
      urls: [],
    };

    // Build the URLs that would be tried
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
        dedicatedUrl += `${separator}pinataGatewayToken=[HIDDEN]`;
      }

      debugInfo.urls.push({
        type: "pinata_dedicated",
        url: dedicatedUrl,
        useAuth: true,
        hasGatewayKey: !!process.env.PINATA_GATEWAY_KEY,
        mappedParams: pinataParams,
      });
    }

    // Fallback gateways
    const fallbackGateways = [
      "https://ipfs.io",
      "https://dweb.link",
      "https://nftstorage.link",
    ];

    fallbackGateways.forEach((gateway) => {
      let fallbackUrl = `${gateway}/ipfs/${cleanHash}${filePath}`;
      if (Object.keys(otherParams).length > 0) {
        fallbackUrl += `?${new URLSearchParams(otherParams).toString()}`;
      }
      debugInfo.urls.push({
        type: "fallback",
        url: fallbackUrl,
        useAuth: false,
      });
    });

    return res.status(200).json(debugInfo);
  } catch (error) {
    return res.status(500).json({
      error: "Debug endpoint error",
      message: error.message,
    });
  }
};
