/** @type {import('next').NextConfig} */
// next.config.mjs — CR AudioViz AI | 2026-03-11
// Webpack forced via --webpack flag in build script.
// Turbopack (Next.js 16 default) misparses Javari-generated template literals.

const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
    serverActions: { bodySizeLimit: '2mb' },
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' }
    ]
  }
};

export default nextConfig;
