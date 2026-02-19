/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Prevent 'crypto' Node built-in from being bundled in edge/browser contexts.
  // vault-crypto.ts is server-only and should only be imported in nodejs runtime routes.
  webpack: (config, { isServer, nextRuntime }) => {
    if (!isServer || nextRuntime === 'edge') {
      // Edge runtime and browser: mark Node built-ins as empty modules
      config.resolve = config.resolve || {};
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        crypto: false,
        stream: false,
        buffer: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
