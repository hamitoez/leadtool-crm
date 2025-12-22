import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output für einfacheres Deployment
  output: "standalone",

  // Erlaubte Dev-Origins für Cross-Origin-Requests
  allowedDevOrigins: [
    "performanty.de",
    "www.performanty.de",
    "https://performanty.de",
    "https://www.performanty.de",
  ],

  // Image-Optimierung konfigurieren
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },

  // Turbopack configuration (empty to silence warnings)
  turbopack: {},

  // Webpack-Konfiguration für Production
  webpack: (config) => {
    return config;
  },
};

export default nextConfig;
