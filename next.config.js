const remotePatterns = [];

try {
  const supabaseUrl = new URL(process.env.SUPABASE_URL);
  for (const bucket of ['profile-avatars', 'group-images']) {
    remotePatterns.push({
      protocol: supabaseUrl.protocol.slice(0, -1),
      hostname: supabaseUrl.hostname,
      port: supabaseUrl.port,
      pathname: `/storage/v1/object/public/${bucket}/**`,
    });
  }
} catch {
  // The app still builds without Supabase credentials and shows its setup notice.
}

const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Reuse visited pages without requesting another RSC payload on each tap.
    // Saves and changes to login/group scope invalidate the router cache.
    staleTimes: { dynamic: 30, static: 30 },
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
    // Uploaded avatar URLs are versioned after every change, so long-lived
    // optimized variants cannot mask a newly saved photo.
    minimumCacheTTL: 60 * 60 * 24 * 31,
    maximumResponseBody: 5 * 1024 * 1024,
    remotePatterns,
  },
  // Improve performance with compression
  compress: true,
};

module.exports = nextConfig;
