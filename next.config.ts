import path from "node:path";

import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  output: "standalone",
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
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
  /** Stripe: resolução default aponta para `stripe.cjs.node.js`; no Cloudflare (workerd / nodejs_compat) usar bundle worker (fetch HTTP). */
  webpack: (config, { isServer }) => {
    if (isServer) {
      // `require.resolve("stripe")` → .../stripe/cjs/stripe.cjs.node.js (package sem export de package.json)
      const stripeNodeEntry = require.resolve("stripe");
      const stripeCjsDir = path.dirname(stripeNodeEntry);
      config.resolve = config.resolve ?? {};
      config.resolve.alias = {
        ...config.resolve.alias,
        stripe: path.join(stripeCjsDir, "stripe.cjs.worker.js"),
      };
    }
    return config;
  },
};

export default nextConfig;
