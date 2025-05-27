module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method Not Allowed",
      message: "Only GET requests are allowed for health check",
    });
  }

  try {
    const health = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      service: "ipfs-reverse-proxy",
      version: "1.0.0",
      environment: {
        hasApiKey: !!process.env.API_KEY,
        hasPinataJwt: !!process.env.PINATA_JWT,
        allowedOrigins: process.env.ALLOWED_ORIGINS
          ? process.env.ALLOWED_ORIGINS.split(",").length
          : 0,
        hasDedicatedGateway: !!process.env.PINATA_GATEWAY_DOMAIN,
      },
    };

    res.status(200).json(health);
  } catch (error) {
    console.error("Health check error:", error);
    res.status(500).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
};
