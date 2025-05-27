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

The proxy supports multiple URL patterns:

```javascript
// All of these work:
"https://ipfs.wallacemuseum.com/QmYourIPFSHash"; // Direct CID
"https://ipfs.wallacemuseum.com/ipfs/QmYourIPFSHash"; // IPFS path
"https://ipfs.wallacemuseum.com/gateway/QmYourIPFSHash"; // Gateway path
"https://ipfs.wallacemuseum.com/api/proxy?hash=QmYourIPFSHash"; // API endpoint
```

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

| Variable                | Required | Description                              |
| ----------------------- | -------- | ---------------------------------------- |
| `PINATA_JWT`            | Yes      | Your Pinata JWT token from the dashboard |
| `API_KEY`               | No       | Not used for public image serving        |
| `PINATA_GATEWAY_DOMAIN` | No       | Your dedicated gateway domain            |

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
