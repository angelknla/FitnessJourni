const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      // Allows a 5 MB avatar plus multipart form overhead.
      bodySizeLimit: '6mb',
    },
  },
  images: {
    // Enable modern image formats
    formats: ['image/avif', 'image/webp'],
    // Optimize device sizes for responsive images
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Configure image qualities
    qualities: [75, 80, 85],
  },
  // Improve performance with compression
  compress: true,
};

module.exports = nextConfig;
