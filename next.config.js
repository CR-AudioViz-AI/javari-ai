/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React strict mode for better development experience
  reactStrictMode: true,

  // Experimental features
  experimental: {
    // Enable Server Actions (required for Next.js 14 forms and mutations)
    serverActions: {
      bodySizeLimit: '2mb'
    }
  },

  // Image optimization configuration
  images: {
    // Allow images from these domains
    domains: [
      'craudiovizai.com',
      'www.craudiovizai.com',
      'avatars.githubusercontent.com',
      'lh3.googleusercontent.com'
    ],
    // Remote patterns for more flexible image loading
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        pathname: '/storage/v1/**'
      }
    ]
  },

  // Webpack configuration
  webpack: (config, { isServer }) => {
    // Fix for "Module not found" errors with certain packages
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false
      };
    }
    return config;
  },

  // Headers for security and CORS
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          }
        ]
      }
    ];
  }
};

module.exports = nextConfig;
