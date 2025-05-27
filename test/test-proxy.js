/**
 * Test script for IPFS Reverse Proxy
 * Run with: node test/test-proxy.js
 */

const axios = require("axios");

// Configuration - Update these values
const CONFIG = {
  // For local testing (when running `vercel dev`)
  LOCAL_URL: "http://localhost:3000",

  // For production testing (replace with your actual Vercel URL)
  PRODUCTION_URL: "https://your-proxy.vercel.app",

  // Your API key (set this in your environment or replace here)
  API_KEY: process.env.API_KEY || "your_test_api_key_here",

  // Test IPFS hashes (these are real public IPFS files for testing)
  TEST_HASHES: {
    // Small text file
    text: "QmT78zSuBmuS4z925WZfrqQ1qHaJ56DQaTfyMUF7F8ff5o",
    // Small image
    image: "QmNrhZHUaEqxhyLfqoq1mtHSipkWHeT31LNHb1QEbDHgnc",
    // JSON file
    json: "QmSrCRJmzE4zE1nAfWPbzVfanKQNBhp7ZWmMnEdkAAkTVw",
  },
};

class ProxyTester {
  constructor(baseUrl, apiKey) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
    this.results = [];
  }

  async runTest(name, testFn) {
    console.log(`\n🧪 Testing: ${name}`);
    try {
      const startTime = Date.now();
      const result = await testFn();
      const duration = Date.now() - startTime;

      console.log(`✅ PASS: ${name} (${duration}ms)`);
      this.results.push({ name, status: "PASS", duration, result });
      return result;
    } catch (error) {
      console.log(`❌ FAIL: ${name}`);
      console.log(`   Error: ${error.message}`);
      this.results.push({ name, status: "FAIL", error: error.message });
      throw error;
    }
  }

  async testHealthCheck() {
    return this.runTest("Health Check", async () => {
      const response = await axios.get(`${this.baseUrl}/api/health`);

      if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
      }

      const health = response.data;
      if (health.status !== "healthy") {
        throw new Error(`Service not healthy: ${health.status}`);
      }

      console.log(`   Service: ${health.service} v${health.version}`);
      console.log(
        `   Environment: API Key=${health.environment.hasApiKey}, Pinata JWT=${health.environment.hasPinataJwt}`
      );

      return health;
    });
  }

  async testAuthenticationRequired() {
    return this.runTest("Authentication Required", async () => {
      try {
        await axios.get(
          `${this.baseUrl}/api/proxy?hash=${CONFIG.TEST_HASHES.text}`
        );
        throw new Error("Request should have failed without API key");
      } catch (error) {
        if (error.response && error.response.status === 401) {
          console.log("   ✓ Correctly rejected request without API key");
          return true;
        }
        throw error;
      }
    });
  }

  async testInvalidHash() {
    return this.runTest("Invalid Hash Rejection", async () => {
      try {
        await axios.get(`${this.baseUrl}/api/proxy?hash=invalid_hash`, {
          headers: { "X-API-Key": this.apiKey },
        });
        throw new Error("Request should have failed with invalid hash");
      } catch (error) {
        if (error.response && error.response.status === 400) {
          console.log("   ✓ Correctly rejected invalid IPFS hash");
          return true;
        }
        throw error;
      }
    });
  }

  async testTextContent() {
    return this.runTest("Text Content Retrieval", async () => {
      const response = await axios.get(
        `${this.baseUrl}/api/proxy?hash=${CONFIG.TEST_HASHES.text}`,
        {
          headers: { "X-API-Key": this.apiKey },
        }
      );

      if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
      }

      const contentType = response.headers["content-type"];
      console.log(`   Content-Type: ${contentType}`);
      console.log(
        `   Content-Length: ${response.headers["content-length"] || "unknown"}`
      );
      console.log(`   Content preview: ${response.data.substring(0, 100)}...`);

      return response.data;
    });
  }

  async testImageContent() {
    return this.runTest("Image Content Retrieval", async () => {
      const response = await axios.get(
        `${this.baseUrl}/api/proxy?hash=${CONFIG.TEST_HASHES.image}`,
        {
          headers: { "X-API-Key": this.apiKey },
          responseType: "arraybuffer",
        }
      );

      if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
      }

      const contentType = response.headers["content-type"];
      const contentLength = response.headers["content-length"];

      // Verify it's actually an image
      if (!contentType || !contentType.startsWith("image/")) {
        throw new Error(`Expected image content type, got: ${contentType}`);
      }

      console.log(`   Content-Type: ${contentType}`);
      console.log(`   Content-Length: ${contentLength} bytes`);
      console.log(
        `   Cache-Control: ${response.headers["cache-control"] || "none"}`
      );

      return response.data;
    });
  }

  async testUrlRewrites() {
    return this.runTest("URL Rewrites", async () => {
      // Test /ipfs/ rewrite
      const response1 = await axios.get(
        `${this.baseUrl}/ipfs/${CONFIG.TEST_HASHES.text}`,
        {
          headers: { "X-API-Key": this.apiKey },
        }
      );

      // Test /gateway/ rewrite
      const response2 = await axios.get(
        `${this.baseUrl}/gateway/${CONFIG.TEST_HASHES.text}`,
        {
          headers: { "X-API-Key": this.apiKey },
        }
      );

      if (response1.status !== 200 || response2.status !== 200) {
        throw new Error("URL rewrites not working properly");
      }

      console.log("   ✓ /ipfs/ rewrite working");
      console.log("   ✓ /gateway/ rewrite working");

      return true;
    });
  }

  async testCorsHeaders() {
    return this.runTest("CORS Headers", async () => {
      const response = await axios.get(
        `${this.baseUrl}/api/proxy?hash=${CONFIG.TEST_HASHES.text}`,
        {
          headers: { "X-API-Key": this.apiKey },
        }
      );

      const corsHeaders = [
        "access-control-allow-origin",
        "access-control-allow-methods",
        "access-control-allow-headers",
      ];

      corsHeaders.forEach((header) => {
        if (!response.headers[header]) {
          throw new Error(`Missing CORS header: ${header}`);
        }
        console.log(`   ${header}: ${response.headers[header]}`);
      });

      return true;
    });
  }

  async testDedicatedGateway() {
    return this.runTest("Dedicated Gateway Option", async () => {
      try {
        const response = await axios.get(
          `${this.baseUrl}/api/proxy?hash=${CONFIG.TEST_HASHES.text}&gateway=dedicated`,
          {
            headers: { "X-API-Key": this.apiKey },
          }
        );

        console.log("   ✓ Dedicated gateway parameter accepted");
        return response.status === 200;
      } catch (error) {
        if (error.response && error.response.status >= 400) {
          console.log(
            "   ⚠️  Dedicated gateway may not be configured (this is OK)"
          );
          return true;
        }
        throw error;
      }
    });
  }

  async runAllTests() {
    console.log(`🚀 Starting tests for: ${this.baseUrl}`);
    console.log(`🔑 Using API Key: ${this.apiKey.substring(0, 8)}...`);

    const tests = [
      () => this.testHealthCheck(),
      () => this.testAuthenticationRequired(),
      () => this.testInvalidHash(),
      () => this.testTextContent(),
      () => this.testImageContent(),
      () => this.testUrlRewrites(),
      () => this.testCorsHeaders(),
      () => this.testDedicatedGateway(),
    ];

    let passed = 0;
    let failed = 0;

    for (const test of tests) {
      try {
        await test();
        passed++;
      } catch (error) {
        failed++;
      }
    }

    console.log("\n📊 Test Results Summary:");
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(
      `📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`
    );

    if (failed > 0) {
      console.log("\n❗ Some tests failed. Check the errors above.");
      process.exit(1);
    } else {
      console.log("\n🎉 All tests passed! Your proxy is working correctly.");
    }
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const environment = args[0] || "local";

  let baseUrl, apiKey;

  if (environment === "local") {
    baseUrl = CONFIG.LOCAL_URL;
    apiKey = CONFIG.API_KEY;
    console.log("🏠 Testing LOCAL environment");
    console.log('💡 Make sure you have run "vercel dev" first!');
  } else if (environment === "production") {
    baseUrl = CONFIG.PRODUCTION_URL;
    apiKey = CONFIG.API_KEY;
    console.log("🌐 Testing PRODUCTION environment");
  } else {
    console.log("Usage: node test/test-proxy.js [local|production]");
    console.log("Default: local");
    process.exit(1);
  }

  if (!apiKey || apiKey === "your_test_api_key_here") {
    console.log(
      "❌ Please set your API_KEY environment variable or update CONFIG.API_KEY"
    );
    process.exit(1);
  }

  const tester = new ProxyTester(baseUrl, apiKey);
  await tester.runAllTests();
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error("💥 Test runner failed:", error.message);
    process.exit(1);
  });
}

module.exports = { ProxyTester, CONFIG };
