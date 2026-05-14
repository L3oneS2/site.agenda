import type { NextConfig } from "next";

if (process.env.NODE_ENV === "development") {
  void import("@cloudflare/next-on-pages/next-dev")
    .then(({ setupDevPlatform }) => setupDevPlatform())
    .catch((err: unknown) =>
      console.error("[@cloudflare/next-on-pages] setupDevPlatform:", err)
    );
}

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
