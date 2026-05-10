import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ["framer-motion", "sonner"],
  },
  images: {
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
