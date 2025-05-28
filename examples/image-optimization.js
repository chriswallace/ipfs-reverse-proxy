/**
 * IPFS Image Optimization Examples
 *
 * This file demonstrates how to use the image optimization features
 * of the IPFS reverse proxy programmatically.
 */

// Base URL for your IPFS reverse proxy
const BASE_URL = "https://ipfs.wallacemuseum.com";

/**
 * Helper class for building optimized image URLs
 */
class IPFSImageOptimizer {
  constructor(baseUrl = BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Build an optimized image URL
   * @param {string} hash - IPFS hash of the image
   * @param {Object} options - Optimization options
   * @returns {string} Optimized image URL
   */
  buildUrl(hash, options = {}) {
    const {
      width,
      height,
      dpr,
      fit,
      gravity,
      quality,
      format,
      animation,
      sharpen,
      onError,
      metadata,
      gateway,
    } = options;

    const params = new URLSearchParams();
    params.append("hash", hash);

    if (width) params.append("width", width.toString());
    if (height) params.append("height", height.toString());
    if (dpr) params.append("dpr", dpr.toString());
    if (fit) params.append("fit", fit);
    if (gravity) params.append("gravity", gravity);
    if (quality) params.append("quality", quality.toString());
    if (format) params.append("format", format);
    if (animation !== undefined)
      params.append("animation", animation.toString());
    if (sharpen) params.append("sharpen", sharpen.toString());
    if (onError) params.append("onError", onError);
    if (metadata) params.append("metadata", metadata);
    if (gateway) params.append("gateway", gateway);

    return `${this.baseUrl}/api/image?${params.toString()}`;
  }

  /**
   * Create a responsive image srcset
   * @param {string} hash - IPFS hash of the image
   * @param {number[]} widths - Array of widths for different screen sizes
   * @param {Object} options - Additional optimization options
   * @returns {string} srcset string
   */
  createSrcSet(hash, widths, options = {}) {
    return widths
      .map((width) => {
        const url = this.buildUrl(hash, { ...options, width });
        return `${url} ${width}w`;
      })
      .join(", ");
  }

  /**
   * Create a retina-ready image URL
   * @param {string} hash - IPFS hash of the image
   * @param {number} width - Base width
   * @param {Object} options - Additional optimization options
   * @returns {Object} Object with regular and retina URLs
   */
  createRetinaUrls(hash, width, options = {}) {
    return {
      regular: this.buildUrl(hash, { ...options, width }),
      retina: this.buildUrl(hash, { ...options, width, dpr: 2 }),
    };
  }
}

// Example usage
const optimizer = new IPFSImageOptimizer();

// Example IPFS hash (replace with actual hash)
const exampleHash = "QmYourImageHashHere";

console.log("=== IPFS Image Optimization Examples ===\n");

// Basic resizing
console.log("1. Basic Resizing:");
console.log("Original:", `${BASE_URL}/${exampleHash}`);
console.log("300px width:", optimizer.buildUrl(exampleHash, { width: 300 }));
console.log(
  "200x200 contain:",
  optimizer.buildUrl(exampleHash, { width: 200, height: 200, fit: "contain" })
);
console.log(
  "200x200 cover:",
  optimizer.buildUrl(exampleHash, { width: 200, height: 200, fit: "cover" })
);
console.log();

// Format optimization
console.log("2. Format Optimization:");
console.log(
  "WebP:",
  optimizer.buildUrl(exampleHash, { width: 300, format: "webp" })
);
console.log(
  "AVIF:",
  optimizer.buildUrl(exampleHash, { width: 300, format: "avif" })
);
console.log(
  "Auto format:",
  optimizer.buildUrl(exampleHash, { width: 300, format: "auto" })
);
console.log();

// Quality control
console.log("3. Quality Control:");
console.log(
  "High quality (90):",
  optimizer.buildUrl(exampleHash, { width: 300, quality: 90 })
);
console.log(
  "Medium quality (60):",
  optimizer.buildUrl(exampleHash, { width: 300, quality: 60 })
);
console.log(
  "Low quality (30):",
  optimizer.buildUrl(exampleHash, { width: 300, quality: 30 })
);
console.log();

// Advanced features
console.log("4. Advanced Features:");
console.log(
  "Retina (2x DPR):",
  optimizer.buildUrl(exampleHash, { width: 150, dpr: 2 })
);
console.log(
  "Sharpened:",
  optimizer.buildUrl(exampleHash, { width: 300, sharpen: 2 })
);
console.log(
  "Auto gravity crop:",
  optimizer.buildUrl(exampleHash, {
    width: 200,
    height: 200,
    fit: "cover",
    gravity: "auto",
  })
);
console.log();

// Responsive images
console.log("5. Responsive Images:");
const responsiveWidths = [300, 600, 900, 1200];
const srcset = optimizer.createSrcSet(exampleHash, responsiveWidths, {
  format: "webp",
});
console.log("Srcset:", srcset);
console.log();

// Retina support
console.log("6. Retina Support:");
const retinaUrls = optimizer.createRetinaUrls(exampleHash, 300, {
  format: "webp",
});
console.log("Regular:", retinaUrls.regular);
console.log("Retina:", retinaUrls.retina);
console.log();

/**
 * Example: Create an optimized image element for the DOM
 */
function createOptimizedImage(hash, options = {}) {
  const {
    width = 300,
    alt = "",
    className = "",
    responsive = false,
    retina = false,
  } = options;

  const img = document.createElement("img");

  if (responsive) {
    // Create responsive image with srcset
    const widths = [300, 600, 900];
    img.src = optimizer.buildUrl(hash, { width: 600, format: "webp" });
    img.srcset = optimizer.createSrcSet(hash, widths, { format: "webp" });
    img.sizes = "(max-width: 600px) 300px, (max-width: 900px) 600px, 900px";
  } else if (retina) {
    // Create retina-ready image
    const urls = optimizer.createRetinaUrls(hash, width, { format: "webp" });
    img.src = urls.regular;
    img.srcset = `${urls.regular} 1x, ${urls.retina} 2x`;
  } else {
    // Simple optimized image
    img.src = optimizer.buildUrl(hash, { width, format: "webp" });
  }

  img.alt = alt;
  img.className = className;

  return img;
}

/**
 * Example: Preload critical images
 */
function preloadImage(hash, options = {}) {
  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "image";
  link.href = optimizer.buildUrl(hash, options);
  document.head.appendChild(link);
}

/**
 * Example: Lazy loading with intersection observer
 */
function setupLazyLoading() {
  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const img = entry.target;
        const hash = img.dataset.hash;
        const width = img.dataset.width || 300;

        img.src = optimizer.buildUrl(hash, {
          width: parseInt(width),
          format: "webp",
          quality: 85,
        });

        img.classList.remove("lazy");
        observer.unobserve(img);
      }
    });
  });

  // Observe all images with data-hash attribute
  document.querySelectorAll("img[data-hash]").forEach((img) => {
    imageObserver.observe(img);
  });
}

/**
 * Example: Progressive image loading (blur-up technique)
 */
function createProgressiveImage(hash, options = {}) {
  const { width = 300, height = 200 } = options;

  const container = document.createElement("div");
  container.style.position = "relative";
  container.style.overflow = "hidden";

  // Low quality placeholder
  const placeholder = document.createElement("img");
  placeholder.src = optimizer.buildUrl(hash, {
    width: Math.floor(width / 10),
    height: Math.floor(height / 10),
    quality: 20,
    format: "webp",
  });
  placeholder.style.filter = "blur(5px)";
  placeholder.style.transform = "scale(1.1)";
  placeholder.style.transition = "opacity 0.3s";

  // High quality image
  const fullImage = document.createElement("img");
  fullImage.style.position = "absolute";
  fullImage.style.top = "0";
  fullImage.style.left = "0";
  fullImage.style.opacity = "0";
  fullImage.style.transition = "opacity 0.3s";

  fullImage.onload = () => {
    fullImage.style.opacity = "1";
    placeholder.style.opacity = "0";
  };

  fullImage.src = optimizer.buildUrl(hash, {
    width,
    height,
    quality: 85,
    format: "webp",
    fit: "cover",
  });

  container.appendChild(placeholder);
  container.appendChild(fullImage);

  return container;
}

// Export for use in other modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    IPFSImageOptimizer,
    createOptimizedImage,
    preloadImage,
    setupLazyLoading,
    createProgressiveImage,
  };
}

console.log("7. DOM Helper Functions:");
console.log("- createOptimizedImage(hash, options)");
console.log("- preloadImage(hash, options)");
console.log("- setupLazyLoading()");
console.log("- createProgressiveImage(hash, options)");
console.log();

console.log("=== Ready to use! ===");
console.log(
  'Replace "QmYourImageHashHere" with actual IPFS hashes to test the optimization.'
);
