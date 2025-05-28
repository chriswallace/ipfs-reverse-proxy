#!/usr/bin/env node

/**
 * Test script for IPFS Image Optimization
 *
 * This script tests the image optimization endpoints and generates
 * example URLs for testing.
 */

const axios = require("axios");

// Configuration
const BASE_URL = process.env.BASE_URL || "https://ipfs.wallacemuseum.com";
const TEST_HASH = process.env.TEST_HASH || "QmYourTestImageHash";

console.log("🖼️  IPFS Image Optimization Test\n");
console.log(`Base URL: ${BASE_URL}`);
console.log(`Test Hash: ${TEST_HASH}`);
console.log("📝 Note: Image optimization uses Pinata /files/{cid} endpoint\n");

// Test cases
const testCases = [
  {
    name: "Basic Resize",
    url: `${BASE_URL}/api/image?hash=${TEST_HASH}&width=300`,
    description: "Resize image to 300px width",
  },
  {
    name: "WebP Conversion",
    url: `${BASE_URL}/api/image?hash=${TEST_HASH}&width=300&format=webp`,
    description: "Convert to WebP format",
  },
  {
    name: "Square Thumbnail",
    url: `${BASE_URL}/api/image?hash=${TEST_HASH}&width=200&height=200&fit=cover`,
    description: "Create 200x200 square thumbnail",
  },
  {
    name: "High Quality",
    url: `${BASE_URL}/api/image?hash=${TEST_HASH}&width=500&quality=90&format=webp`,
    description: "High quality WebP image",
  },
  {
    name: "Retina Ready",
    url: `${BASE_URL}/api/image?hash=${TEST_HASH}&width=300&dpr=2&format=webp`,
    description: "2x DPR for retina displays",
  },
  {
    name: "Smart Crop",
    url: `${BASE_URL}/api/image?hash=${TEST_HASH}&width=400&height=300&fit=cover&gravity=auto`,
    description: "Smart cropping with auto gravity",
  },
  {
    name: "AVIF Format",
    url: `${BASE_URL}/api/image?hash=${TEST_HASH}&width=300&format=avif`,
    description: "Convert to AVIF format",
  },
  {
    name: "Sharpened",
    url: `${BASE_URL}/api/image?hash=${TEST_HASH}&width=300&sharpen=2&format=webp`,
    description: "Apply sharpening filter",
  },
  {
    name: "Convenient Route",
    url: `${BASE_URL}/image/${TEST_HASH}?width=300&format=webp`,
    description: "Using convenient /image/ route",
  },
  {
    name: "Traditional Proxy",
    url: `${BASE_URL}/${TEST_HASH}?width=300&format=webp`,
    description: "Using traditional proxy with optimization",
  },
];

// Generate test URLs
console.log("📋 Test URLs:\n");
testCases.forEach((test, index) => {
  console.log(`${index + 1}. ${test.name}`);
  console.log(`   ${test.description}`);
  console.log(`   ${test.url}\n`);
});

// Test health endpoint
async function testHealthEndpoint() {
  try {
    console.log("🏥 Testing health endpoint...");
    const response = await axios.get(`${BASE_URL}/api/health`);

    console.log("✅ Health check successful");
    console.log("📊 Health data:");
    console.log(JSON.stringify(response.data, null, 2));

    if (response.data.features?.imageOptimization) {
      console.log("✅ Image optimization is enabled");
    } else {
      console.log("❌ Image optimization is not enabled");
    }

    return true;
  } catch (error) {
    console.log("❌ Health check failed:", error.message);
    return false;
  }
}

// Test image endpoint (basic connectivity)
async function testImageEndpoint() {
  try {
    console.log("\n🖼️  Testing image endpoint...");

    // Test with a simple request (will likely fail with test hash, but should return proper error)
    const response = await axios.get(
      `${BASE_URL}/api/image?hash=${TEST_HASH}&width=100`,
      {
        validateStatus: () => true, // Don't throw on 4xx/5xx
      }
    );

    if (response.status === 200) {
      console.log("✅ Image endpoint working (got image data)");
      console.log(`📏 Content-Type: ${response.headers["content-type"]}`);
      console.log(`📦 Content-Length: ${response.headers["content-length"]}`);
    } else if (response.status === 400) {
      console.log(
        "⚠️  Image endpoint responding (400 - likely invalid test hash)"
      );
      console.log("💡 This is expected if using placeholder hash");
    } else if (response.status === 404) {
      console.log("⚠️  Image endpoint responding (404 - image not found)");
      console.log("💡 This is expected if using placeholder hash");
    } else {
      console.log(`⚠️  Image endpoint responding (${response.status})`);
    }

    return true;
  } catch (error) {
    console.log("❌ Image endpoint test failed:", error.message);
    return false;
  }
}

// Generate HTML test page
function generateTestHTML() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>IPFS Image Optimization Test</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
        .test-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .test-item { border: 1px solid #ddd; padding: 15px; border-radius: 8px; }
        .test-item img { max-width: 100%; height: auto; border-radius: 4px; }
        .test-item h3 { margin-top: 0; color: #333; }
        .test-item p { color: #666; font-size: 14px; }
        .url { background: #f5f5f5; padding: 8px; border-radius: 4px; font-family: monospace; font-size: 12px; word-break: break-all; }
    </style>
</head>
<body>
    <h1>IPFS Image Optimization Test</h1>
    <p>Replace <code>${TEST_HASH}</code> with a real IPFS image hash to see the optimization in action.</p>
    
    <div class="test-grid">
${testCases
  .map(
    (test) => `        <div class="test-item">
            <h3>${test.name}</h3>
            <p>${test.description}</p>
            <img src="${test.url}" alt="${test.name}" onerror="this.style.display='none'">
            <div class="url">${test.url}</div>
        </div>`
  )
  .join("\n")}
    </div>
    
    <script>
        console.log('Image optimization test page loaded');
        console.log('Replace "${TEST_HASH}" with a real IPFS image hash to test');
    </script>
</body>
</html>`;

  return html;
}

// Main test function
async function runTests() {
  console.log("🚀 Starting tests...\n");

  const healthOk = await testHealthEndpoint();
  const imageOk = await testImageEndpoint();

  console.log("\n📝 Test Summary:");
  console.log(`Health endpoint: ${healthOk ? "✅" : "❌"}`);
  console.log(`Image endpoint: ${imageOk ? "✅" : "❌"}`);

  if (process.argv.includes("--generate-html")) {
    const fs = require("fs");
    const html = generateTestHTML();
    fs.writeFileSync("test-image-optimization.html", html);
    console.log("\n📄 Generated test-image-optimization.html");
  }

  console.log("\n💡 Tips:");
  console.log("- Replace TEST_HASH with a real IPFS image hash");
  console.log("- Use --generate-html flag to create a visual test page");
  console.log(
    "- Set BASE_URL environment variable to test different deployments"
  );

  console.log("\n🎉 Test complete!");
}

// Run tests if called directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  testCases,
  testHealthEndpoint,
  testImageEndpoint,
  generateTestHTML,
};
