/** @type {import('next').NextConfig} */
const nextConfig = {
  // Performance optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production', // Remove console.log in production
  },

  // No `images.remotePatterns`: every image this app renders is local. Add the
  // host here if that ever stops being true.

  rewrites: async () => {
    return [
      {
        source: "/api/:path*",
        destination:
          process.env.NODE_ENV === "development"
            ? "http://127.0.0.1:8000/api/:path*"
            : "/api/",
      },
      {
        source: "/docs",
        destination:
          process.env.NODE_ENV === "development"
            ? "http://127.0.0.1:8000/docs"
            : "/api/docs",
      },
      {
        source: "/openapi.json",
        destination:
          process.env.NODE_ENV === "development"
            ? "http://127.0.0.1:8000/openapi.json"
            : "/api/openapi.json",
      },
    ];
  },

  // The dev rewrite above proxies /api to FastAPI, and Next.js gives a proxied
  // request 30 seconds by default. The backend sends nothing until the agent has
  // finished, and a multi-query answer can take longer than that, so the proxy
  // hung up and the browser saw a 500 for an answer that did complete. Only the
  // dev proxy reads this; production routes /api without it.
  experimental: {
    proxyTimeout: 120_000,
  },

  // Reduce bundle size
  productionBrowserSourceMaps: false,
};

module.exports = nextConfig;
