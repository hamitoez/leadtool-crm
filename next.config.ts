import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output für einfacheres Deployment
  output: "standalone",

  // Image-Optimierung konfigurieren
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },

  // Experimentelle Features
  experimental: {
    // Server Actions sind standardmäßig aktiviert in Next.js 14+
  },
};

export default nextConfig;
