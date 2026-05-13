import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Não incluir @supabase/supabase-js: optimizePackageImports quebra o bundle
    // do cliente (createBrowserClient / Realtime) com "__webpack_modules__[moduleId] is not a function".
    optimizePackageImports: ["framer-motion", "sonner"],
  },
  images: {
    formats: ["image/avif", "image/webp"],
  },
  async redirects() {
    return [
      {
        source: "/favicon.ico",
        destination: "/icon",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
