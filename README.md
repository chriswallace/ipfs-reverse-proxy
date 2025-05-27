# IPFS Reverse Proxy for Pinata

A secure reverse proxy media server for Pinata IPFS gateway that can be deployed as a microservice on Vercel.

## Features

- 🔐 **Secure Authentication**: Uses API keys to restrict access to your app only
- 🚀 **Vercel Ready**: Optimized for serverless deployment on Vercel
- 🎯 **Pinata Integration**: Seamlessly proxies requests to Pinata IPFS gateway
- 📱 **CORS Enabled**: Properly configured for web applications
- 🎬 **Media Optimized**: Optimized caching headers for images, videos, and audio
- 🔍 **Health Monitoring**: Built-in health check endpoint
- ⚡ **Fast**: Streams content directly without buffering

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
API_KEY=your_secure_api_key_here
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
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
vercel env add API_KEY
vercel env add ALLOWED_ORIGINS
vercel env add PINATA_GATEWAY_DOMAIN
```

## Usage

### Basic Request

```javascript
// In your app
const response = await fetch(
  "https://your-proxy.vercel.app/api/proxy?hash=QmYourIPFSHash",
  {
    headers: {
      "X-API-Key": "your_secure_api_key_here",
    },
  }
);
```

### Using URL Rewrites

The proxy supports friendly URLs:

```javascript
// These are equivalent:
fetch("https://your-proxy.vercel.app/ipfs/QmYourIPFSHash", {
  headers: { "X-API-Key": "your_key" },
});
fetch("https://your-proxy.vercel.app/gateway/QmYourIPFSHash", {
  headers: { "X-API-Key": "your_key" },
});
fetch("https://your-proxy.vercel.app/api/proxy?hash=QmYourIPFSHash", {
  headers: { "X-API-Key": "your_key" },
});
```

### Using Dedicated Gateway

If you have a dedicated Pinata gateway:

```javascript
fetch(
  "https://your-proxy.vercel.app/api/proxy?hash=QmYourIPFSHash&gateway=dedicated",
  {
    headers: {
      "X-API-Key": "your_secure_api_key_here",
    },
  }
);
```

### Health Check

```javascript
const health = await fetch("https://your-proxy.vercel.app/api/health");
console.log(await health.json());
```

## API Reference

### `GET /api/proxy`

Proxies requests to Pinata IPFS gateway.

**Query Parameters:**

- `hash` (required): The IPFS hash to retrieve
- `gateway` (optional): Use `dedicated` for dedicated gateway

**Headers:**

- `X-API-Key` (required): Your API key for authentication
- `Authorization` (alternative): Bearer token format

**Example Response:**
Returns the requested IPFS content with appropriate headers.

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
    "allowedOrigins": 2,
    "hasDedicatedGateway": true
  }
}
```

## Security

- **API Key Authentication**: All requests must include a valid API key
- **Origin Validation**: Optional origin checking for additional security
- **Rate Limiting**: Inherits Vercel's built-in rate limiting
- **HTTPS Only**: Secure transmission of all data

## Configuration

### Environment Variables

| Variable                | Required | Description                                |
| ----------------------- | -------- | ------------------------------------------ |
| `PINATA_JWT`            | Yes      | Your Pinata JWT token from the dashboard   |
| `API_KEY`               | Yes      | Secure API key for your app authentication |
| `ALLOWED_ORIGINS`       | No       | Comma-separated list of allowed origins    |
| `PINATA_GATEWAY_DOMAIN` | No       | Your dedicated gateway domain              |

### Vercel Configuration

The `vercel.json` file includes:

- Function timeout configuration (30s max)
- URL rewrites for friendly paths
- CORS headers configuration

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# The proxy will be available at http://localhost:3000
```

## Error Handling

The proxy handles various error scenarios:

- **401 Unauthorized**: Invalid or missing API key
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
