# IPFS Reverse Proxy for Pinata

A secure reverse proxy media server for Pinata IPFS gateway that can be deployed as a microservice on Vercel. **Now with domain-based access control for public image serving.**

## Features

- 🔐 **Domain-Based Security**: Restricts access to specific domains (wallacemuseum.com + localhost)
- 🖼️ **Public Image Serving**: Serve images to the world through your custom domain
- 🚀 **Vercel Ready**: Optimized for serverless deployment on Vercel
- 🎯 **Pinata Integration**: Seamlessly proxies requests to Pinata IPFS gateway
- 📱 **CORS Enabled**: Properly configured for web applications
- 🎬 **Media Optimized**: Optimized caching headers for images, videos, and audio
- 🔍 **Health Monitoring**: Built-in health check endpoint
- ⚡ **Fast**: Streams content directly without buffering
- 🌐 **Custom Domain Support**: Works with custom domains like `ipfs.wallacemuseum.com`
- 🌍 **No API Keys Required**: Public access for legitimate browser requests
- 🔄 **Fallback Gateways**: Automatically tries multiple IPFS gateways if content is not found
- 🎨 **Image Optimization**: Advanced image processing with format conversion, resizing, and optimization

## Quick Start

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd ipfs-reverse-proxy
npm install
```

### 2. Environment Setup

Copy the example environment file and configure your variables:

```bash
cp env.example .env.local
```

Edit `.env.local` with your values:

```env
PINATA_JWT=your_pinata_jwt_token_here
# API_KEY=your_secure_api_key_here  # Optional - not needed for public image serving
PINATA_GATEWAY_DOMAIN=your-gateway.mypinata.cloud
```

### 3. Deploy to Vercel

```bash
# Install Vercel CLI if you haven't already
npm install -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard or via CLI
vercel env add PINATA_JWT
vercel env add PINATA_GATEWAY_DOMAIN
```

### 4. Configure Custom Domain

In your Vercel dashboard:

1. Go to your project settings
2. Add your custom domain (e.g., `ipfs.wallacemuseum.com`)
3. Configure DNS as instructed by Vercel

## Usage

### Public Image Access (New!)

The proxy now supports direct IPFS hash access for public image serving:

```html
<!-- Direct CID access -->
<img src="https://ipfs.wallacemuseum.com/QmYourIPFSHash" alt="Image" />

<!-- Traditional paths also work -->
<img src="https://ipfs.wallacemuseum.com/ipfs/QmYourIPFSHash" alt="Image" />
<img src="https://ipfs.wallacemuseum.com/gateway/QmYourIPFSHash" alt="Image" />
```

### Domain-Based Access Control

The proxy automatically restricts access to these domains:

**✅ Allowed Domains:**

- `https://wallacemuseum.com`
- `https://www.wallacemuseum.com`
- `https://ipfs.wallacemuseum.com`
- `http://localhost:*` (development)
- `http://127.0.0.1:*` (development)

**❌ Blocked:** All other domains will receive 401 Unauthorized

### Using URL Rewrites

The proxy supports multiple URL patterns and handles directories and files seamlessly:

```javascript
// All of these work:
"https://ipfs.wallacemuseum.com/QmYourIPFSHash"; // Direct CID (file or directory)
"https://ipfs.wallacemuseum.com/QmYourIPFSHash/"; // Directory with trailing slash
"https://ipfs.wallacemuseum.com/QmYourIPFSHash/file.txt"; // File within directory
"https://ipfs.wallacemuseum.com/ipfs/QmYourIPFSHash"; // IPFS path
"https://ipfs.wallacemuseum.com/gateway/QmYourIPFSHash"; // Gateway path
"https://ipfs.wallacemuseum.com/api/proxy?hash=QmYourIPFSHash"; // API endpoint
```

**📁 Directory Handling**: The proxy correctly handles IPFS directories:

- `QmHash` - Works for both files and directories
- `QmHash/` - Explicitly requests directory listing (recommended for directories)
- `QmHash/file.txt` - Access specific files within directories

### Code URIs and Query Parameters

The proxy fully supports code URIs with query parameters, commonly used for generative art and interactive content:

```javascript
// Code URI with query parameters (fx(hash) style)
"https://ipfs.wallacemuseum.com/QmYourCodeHash/?fxhash=abc123&fxiteration=42&fxminter=tz1abc";

// Any query parameters are preserved and forwarded to the IPFS gateway
"https://ipfs.wallacemuseum.com/QmYourHash/?param1=value1&param2=value2";
```

**⚠️ HTML Content Restriction:** Pinata's public gateway blocks HTML content for security reasons. For HTML/code content, you **must** configure a dedicated Pinata gateway using the `PINATA_GATEWAY_DOMAIN` environment variable. The proxy will automatically retry with the dedicated gateway when it detects HTML content restrictions.

### Using Dedicated Gateway

If you have a dedicated Pinata gateway:

```javascript
fetch(
  "https://ipfs.wallacemuseum.com/api/proxy?hash=QmYourIPFSHash&gateway=dedicated",
  {
    headers: {
      "X-API-Key": "your_secure_api_key_here",
    },
  }
);
```

### Health Check

```javascript
const health = await fetch("https://ipfs.wallacemuseum.com/api/health");
console.log(await health.json());
```

## Fallback Gateway Support

The proxy includes automatic fallback functionality to ensure maximum content availability. If your dedicated gateway doesn't have a specific CID, the proxy will automatically try multiple public IPFS gateways.

### How Fallback Works

1. **Primary Request**: First tries your dedicated gateway (if configured)
2. **Fallback on 404**: If content is not found (404), automatically tries:
   - `ipfs.io`
   - `dweb.link`
   - `gateway.pinata.cloud`
3. **Best Effort**: Returns content from the first gateway that has it
4. **Graceful Degradation**: Returns 404 only if no gateway has the content

### Fallback Behavior

```javascript
// This request will try multiple gateways automatically
const response = await fetch("https://ipfs.wallacemuseum.com/QmSomeRareHash");

// If found on a fallback gateway, you'll get the content normally
// If not found anywhere, you'll get a 404
```

### Important Notes

- **Image Optimization**: Fallback only works for regular content. Image optimization requires the dedicated gateway's `/files/` endpoint
- **Path Support**: Fallback works with paths (e.g., `/QmHash/readme.txt`)
- **Performance**: Fallback adds latency only when content is not found on the primary gateway
- **Automatic**: No configuration needed - fallback is enabled by default

### Fallback Headers

When content is served from a fallback gateway, the response includes special headers:

```javascript
const response = await fetch("https://ipfs.wallacemuseum.com/QmRareHash");

// Check if content came from fallback
if (response.headers.get("X-Fallback-Gateway")) {
  console.log("Content served from fallback gateway");
}

// For image optimization fallbacks (serves original image)
if (response.headers.get("X-Image-Optimization") === "unavailable") {
  console.log("Image optimization not available, serving original");
}
```

## Image Optimization

The proxy now includes powerful image optimization capabilities powered by Pinata's image optimization features. Transform, resize, and optimize images on-the-fly for better performance and user experience.

**Note:** Image optimization requests use Pinata's `/files/{cid}` endpoint (as per [Pinata's documentation](https://docs.pinata.cloud/gateways/image-optimizations)) rather than the traditional `/ipfs/{cid}` endpoint. This ensures proper access to all image optimization features.

### Basic Image Optimization

```html
<!-- Original image -->
<img src="https://ipfs.wallacemuseum.com/QmYourImageHash" alt="Original" />

<!-- Resized to 300px width -->
<img
  src="https://ipfs.wallacemuseum.com/api/image?hash=QmYourImageHash&width=300"
  alt="Resized"
/>

<!-- Converted to WebP format -->
<img
  src="https://ipfs.wallacemuseum.com/QmYourImageHash?width=300&format=webp"
  alt="WebP"
/>
```

### URL Patterns for Image Optimization

The proxy supports multiple URL patterns for image optimization:

```javascript
// Direct API endpoint (recommended)
"https://ipfs.wallacemuseum.com/api/image?hash=QmYourHash&width=500&format=webp";

// Convenient route
"https://ipfs.wallacemuseum.com/image/QmYourHash?width=500&format=webp";

// Traditional proxy with optimization parameters
"https://ipfs.wallacemuseum.com/QmYourHash?width=500&format=webp";
```

### Image Optimization Parameters

| Parameter   | Type    | Description                    | Example Values                                     |
| ----------- | ------- | ------------------------------ | -------------------------------------------------- |
| `width`     | number  | Maximum width in pixels        | `300`, `500`, `1200`                               |
| `height`    | number  | Maximum height in pixels       | `200`, `400`, `800`                                |
| `dpr`       | number  | Device pixel ratio (1-3)       | `1`, `2`, `3`                                      |
| `fit`       | string  | How to fit image in dimensions | `contain`, `cover`, `crop`, `scale-down`, `pad`    |
| `gravity`   | string  | Focus point for cropping       | `auto`, `center`, `top`, `bottom`, `left`, `right` |
| `quality`   | number  | JPEG/WebP quality (1-100)      | `30`, `60`, `85`, `90`                             |
| `format`    | string  | Output format                  | `auto`, `webp`, `avif`, `jpeg`, `png`              |
| `animation` | boolean | Preserve animations            | `true`, `false`                                    |
| `sharpen`   | number  | Sharpening strength (0-10)     | `1`, `2`, `5`                                      |
| `metadata`  | string  | Metadata handling              | `keep`, `copyright`, `none`                        |

### Responsive Images

Create responsive images with multiple sizes:

```html
<img
  src="https://ipfs.wallacemuseum.com/api/image?hash=QmYourHash&width=600&format=webp"
  srcset="
    https://ipfs.wallacemuseum.com/api/image?hash=QmYourHash&width=300&format=webp 300w,
    https://ipfs.wallacemuseum.com/api/image?hash=QmYourHash&width=600&format=webp 600w,
    https://ipfs.wallacemuseum.com/api/image?hash=QmYourHash&width=900&format=webp 900w
  "
  sizes="(max-width: 600px) 300px, (max-width: 900px) 600px, 900px"
  alt="Responsive image"
/>
```

### Retina/High-DPI Support

```html
<!-- Standard approach -->
<img
  src="https://ipfs.wallacemuseum.com/api/image?hash=QmYourHash&width=300&format=webp"
  srcset="
    https://ipfs.wallacemuseum.com/api/image?hash=QmYourHash&width=300&format=webp       1x,
    https://ipfs.wallacemuseum.com/api/image?hash=QmYourHash&width=300&dpr=2&format=webp 2x
  "
  alt="Retina ready"
/>

<!-- Using DPR parameter -->
<img
  src="https://ipfs.wallacemuseum.com/api/image?hash=QmYourHash&width=300&dpr=2&format=webp"
  alt="2x DPR"
/>
```

### Advanced Examples

```javascript
// Smart cropping with auto gravity
const smartCrop =
  "https://ipfs.wallacemuseum.com/api/image?hash=QmYourHash&width=400&height=300&fit=cover&gravity=auto";

// High quality with sharpening
const sharpened =
  "https://ipfs.wallacemuseum.com/api/image?hash=QmYourHash&width=500&quality=90&sharpen=2&format=webp";

// Thumbnail with aggressive compression
const thumbnail =
  "https://ipfs.wallacemuseum.com/api/image?hash=QmYourHash&width=150&height=150&fit=cover&quality=60&format=webp";

// AVIF format for maximum compression (with WebP fallback)
const avifImage =
  "https://ipfs.wallacemuseum.com/api/image?hash=QmYourHash&width=500&format=avif";
```

### JavaScript Helper Library

Use the included JavaScript helper for easier image optimization:

```javascript
// Import the helper (see examples/image-optimization.js)
import { IPFSImageOptimizer } from "./examples/image-optimization.js";

const optimizer = new IPFSImageOptimizer("https://ipfs.wallacemuseum.com");

// Build optimized URLs
const url = optimizer.buildUrl("QmYourHash", {
  width: 500,
  format: "webp",
  quality: 85,
});

// Create responsive srcset
const srcset = optimizer.createSrcSet("QmYourHash", [300, 600, 900], {
  format: "webp",
});

// Generate retina URLs
const retinaUrls = optimizer.createRetinaUrls("QmYourHash", 300, {
  format: "webp",
});
```

### Performance Best Practices

1. **Use WebP/AVIF formats** for better compression
2. **Implement responsive images** with appropriate sizes
3. **Optimize quality settings** (60-85 for most use cases)
4. **Use appropriate fit modes** (`cover` for thumbnails, `contain` for full images)
5. **Enable retina support** for high-DPI displays
6. **Preload critical images** above the fold
7. **Lazy load** images below the fold

### Examples

See the `examples/` directory for complete examples:

- `examples/image-optimization.html` - Visual examples with different optimization settings
- `examples/image-optimization.js` - JavaScript helper library and usage examples

## API Reference

### `GET /[cid]` (New!)

Direct access to IPFS content by CID.

**Path Parameters:**

- `cid`: Valid IPFS hash (Qm... or bafy...)

**Authentication:** Domain-based (no API key required for allowed domains)

### `GET /ipfs/[cid]`

IPFS-style path access.

**Authentication:** Domain-based (no API key required)

### `GET /gateway/[cid]`

Gateway-style path access.

**Authentication:** Domain-based (no API key required)

### `GET /api/proxy`

Proxies requests to Pinata IPFS gateway.

**Query Parameters:**

- `hash` (required): The IPFS hash to retrieve
- `gateway` (optional): Use `dedicated` for dedicated gateway

**Authentication:** Domain-based (no API key required)

### `GET /api/image` (New!)

Optimized image serving with transformation capabilities.

**Query Parameters:**

- `hash` (required): The IPFS hash of the image to retrieve
- `width` (optional): Maximum width in pixels
- `height` (optional): Maximum height in pixels
- `dpr` (optional): Device pixel ratio (1-3), default: 1
- `fit` (optional): Resize mode - `scale-down`, `contain`, `cover`, `crop`, `pad`, default: `contain`
- `gravity` (optional): Focus point for cropping - `auto`, `center`, `top`, `bottom`, `left`, `right`
- `quality` (optional): Image quality (1-100), default: 85
- `format` (optional): Output format - `auto`, `webp`, `avif`, `jpeg`, `png`, default: `auto`
- `animation` (optional): Preserve animations - `true`, `false`, default: `true`
- `sharpen` (optional): Sharpening strength (0-10)
- `metadata` (optional): Metadata handling - `keep`, `copyright`, `none`, default: `copyright`
- `gateway` (optional): Use `dedicated` for dedicated gateway

**Authentication:** Domain-based (no API key required)

**Example:**

```
GET /api/image?hash=QmYourImageHash&width=500&height=300&format=webp&quality=85
```

### `GET /image/[cid]` (New!)

Convenient route for image optimization.

**Path Parameters:**

- `cid`: Valid IPFS hash (Qm... or bafy...)

**Query Parameters:** Same as `/api/image` (except `hash`)

**Authentication:** Domain-based (no API key required)

**Example:**

```
GET /image/QmYourImageHash?width=500&format=webp
```

### `GET /api/health`

Health check endpoint.

**Example Response:**

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "ipfs-reverse-proxy",
  "version": "1.0.0",
  "environment": {
    "hasApiKey": true,
    "hasPinataJwt": true,
    "allowedOrigins": 5,
    "hasDedicatedGateway": true
  }
}
```

## Security

- **Domain-Based Access Control**: Only allows requests from wallacemuseum.com and localhost
- **Browser-Friendly**: Allows legitimate browser requests for public image access
- **Automated Tool Protection**: Blocks obvious programmatic requests (curl, wget, etc.) without proper origin
- **Origin Validation**: Strict origin checking for all requests with origin headers
- **Rate Limiting**: Inherits Vercel's built-in rate limiting
- **HTTPS Only**: Secure transmission of all data
- **Security Headers**: X-Frame-Options, X-Content-Type-Options, Referrer-Policy

## Configuration

### Environment Variables

| Variable                | Required  | Description                                                    |
| ----------------------- | --------- | -------------------------------------------------------------- |
| `PINATA_JWT`            | Yes       | Your Pinata JWT token from the dashboard                       |
| `API_KEY`               | No        | Not used for public image serving                              |
| `PINATA_GATEWAY_DOMAIN` | **Yes\*** | Your dedicated gateway domain (required for HTML/code content) |

**\*Required for HTML content:** While technically optional, `PINATA_GATEWAY_DOMAIN` is required if you need to serve HTML content, code URIs, or any content that Pinata's public gateway restricts.

### Allowed Domains

The allowed domains are hardcoded in the proxy for security:

```javascript
const ALLOWED_ORIGINS = [
  "https://wallacemuseum.com",
  "https://www.wallacemuseum.com",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:8080",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
  "http://127.0.0.1:8080",
  "https://ipfs.wallacemuseum.com",
];
```

### Vercel Configuration

The `vercel.json` file includes:

- Function timeout configuration (30s max)
- URL rewrites for friendly paths including direct CID access
- CORS headers configuration
- Security headers

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# The proxy will be available at http://localhost:3000
```

### Testing Domain Restrictions

Visit `http://localhost:3000/test-domain.html` to test the domain restrictions interactively.

## Error Handling

The proxy handles various error scenarios:

- **401 Unauthorized**: Request from unauthorized domain
- **400 Bad Request**: Invalid IPFS hash format
- **404 Not Found**: Content not found on IPFS
- **504 Gateway Timeout**: Pinata gateway timeout
- **500 Internal Server Error**: Unexpected errors

## Performance

- **Streaming**: Content is streamed directly without buffering
- **Caching**: Optimized cache headers for media files
- **Timeout**: 25-second timeout to stay within Vercel limits
- **Compression**: Supports range requests for large files

## License

MIT

**Technical Details:**

- **Regular Content**: Uses standard `/ipfs/{cid}{path}` endpoint for maximum compatibility with directories, files, and nested paths
- **Image Optimization**: Uses Pinata's `/files/{cid}` endpoint (as per [Pinata's documentation](https://docs.pinata.cloud/gateways/image-optimizations)) with `img-` prefixed parameters for advanced image processing
- **Fallback System**: Automatically tries multiple public IPFS gateways when content is restricted on dedicated gateways
