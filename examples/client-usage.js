/**
 * Example client-side usage of the IPFS Reverse Proxy
 * This shows how to integrate the proxy into your web application
 */

class IPFSProxyClient {
  constructor(proxyUrl, apiKey) {
    this.proxyUrl = proxyUrl.replace(/\/$/, ""); // Remove trailing slash
    this.apiKey = apiKey;
  }

  /**
   * Get IPFS content via the proxy
   * @param {string} hash - IPFS hash
   * @param {object} options - Additional options
   * @returns {Promise<Response>}
   */
  async getContent(hash, options = {}) {
    const { useDedicatedGateway = false, ...fetchOptions } = options;

    const url = new URL(`${this.proxyUrl}/api/proxy`);
    url.searchParams.set("hash", hash);

    if (useDedicatedGateway) {
      url.searchParams.set("gateway", "dedicated");
    }

    const response = await fetch(url.toString(), {
      headers: {
        "X-API-Key": this.apiKey,
        ...fetchOptions.headers,
      },
      ...fetchOptions,
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ message: "Unknown error" }));
      throw new Error(`Proxy error: ${error.message || response.statusText}`);
    }

    return response;
  }

  /**
   * Get IPFS content as blob (useful for images, videos, etc.)
   * @param {string} hash - IPFS hash
   * @param {object} options - Additional options
   * @returns {Promise<Blob>}
   */
  async getBlob(hash, options = {}) {
    const response = await this.getContent(hash, options);
    return response.blob();
  }

  /**
   * Get IPFS content as text
   * @param {string} hash - IPFS hash
   * @param {object} options - Additional options
   * @returns {Promise<string>}
   */
  async getText(hash, options = {}) {
    const response = await this.getContent(hash, options);
    return response.text();
  }

  /**
   * Get IPFS content as JSON
   * @param {string} hash - IPFS hash
   * @param {object} options - Additional options
   * @returns {Promise<object>}
   */
  async getJSON(hash, options = {}) {
    const response = await this.getContent(hash, options);
    return response.json();
  }

  /**
   * Create an object URL for IPFS content (useful for images/videos)
   * @param {string} hash - IPFS hash
   * @param {object} options - Additional options
   * @returns {Promise<string>}
   */
  async createObjectURL(hash, options = {}) {
    const blob = await this.getBlob(hash, options);
    return URL.createObjectURL(blob);
  }

  /**
   * Get a direct URL to the proxy endpoint
   * @param {string} hash - IPFS hash
   * @param {boolean} useDedicatedGateway - Whether to use dedicated gateway
   * @returns {string}
   */
  getProxyURL(hash, useDedicatedGateway = false) {
    const url = new URL(`${this.proxyUrl}/ipfs/${hash}`);
    if (useDedicatedGateway) {
      url.searchParams.set("gateway", "dedicated");
    }
    return url.toString();
  }

  /**
   * Check proxy health
   * @returns {Promise<object>}
   */
  async checkHealth() {
    const response = await fetch(`${this.proxyUrl}/api/health`);
    return response.json();
  }
}

// Example usage in a React component
class IPFSImageComponent {
  constructor(proxyClient) {
    this.proxy = proxyClient;
  }

  async loadImage(hash, imgElement) {
    try {
      // Show loading state
      imgElement.src =
        "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkxvYWRpbmcuLi48L3RleHQ+PC9zdmc+";

      // Create object URL for the image
      const objectURL = await this.proxy.createObjectURL(hash);

      // Set the image source
      imgElement.src = objectURL;

      // Clean up object URL when image loads
      imgElement.onload = () => {
        URL.revokeObjectURL(objectURL);
      };
    } catch (error) {
      console.error("Failed to load IPFS image:", error);
      // Show error state
      imgElement.src =
        "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjVmNWY1Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkVycm9yPC90ZXh0Pjwvc3ZnPg==";
    }
  }
}

// Example usage
async function example() {
  // Initialize the proxy client
  const proxy = new IPFSProxyClient(
    "https://your-proxy.vercel.app",
    "your_secure_api_key_here"
  );

  try {
    // Check if proxy is healthy
    const health = await proxy.checkHealth();
    console.log("Proxy health:", health);

    // Example IPFS hash (replace with your actual hash)
    const ipfsHash = "QmYourIPFSHashHere";

    // Get content as blob (for images, videos, etc.)
    const blob = await proxy.getBlob(ipfsHash);
    console.log("Content type:", blob.type);
    console.log("Content size:", blob.size);

    // Get content as text (for text files, JSON, etc.)
    const text = await proxy.getText(ipfsHash);
    console.log("Content:", text);

    // Create object URL for use in img/video tags
    const objectURL = await proxy.createObjectURL(ipfsHash);

    // Use with an image element
    const img = document.createElement("img");
    img.src = objectURL;
    document.body.appendChild(img);

    // Clean up when done
    img.onload = () => URL.revokeObjectURL(objectURL);

    // Or get a direct proxy URL (useful for src attributes)
    const proxyURL = proxy.getProxyURL(ipfsHash);
    console.log("Direct proxy URL:", proxyURL);
  } catch (error) {
    console.error("Error:", error.message);
  }
}

// React Hook example
function useIPFSContent(hash, options = {}) {
  const [content, setContent] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const proxy = React.useMemo(
    () =>
      new IPFSProxyClient(
        process.env.REACT_APP_PROXY_URL,
        process.env.REACT_APP_API_KEY
      ),
    []
  );

  React.useEffect(() => {
    if (!hash) return;

    setLoading(true);
    setError(null);

    proxy
      .getContent(hash, options)
      .then((response) => response.blob())
      .then((blob) => {
        const objectURL = URL.createObjectURL(blob);
        setContent(objectURL);
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });

    // Cleanup function
    return () => {
      if (content) {
        URL.revokeObjectURL(content);
      }
    };
  }, [hash, proxy, options]);

  return { content, loading, error };
}

// Export for use in other modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = { IPFSProxyClient, IPFSImageComponent };
}
