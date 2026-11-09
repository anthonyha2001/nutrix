import type { NextConfig } from "next";

// Same runtime setup as Gymix.
const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  // Headless Chrome for plan PDFs stays outside the bundle.
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium"],
  outputFileTracingIncludes: {
    "/api/plans/[id]/pdf": ["./node_modules/@sparticuz/chromium/bin/**"],
    "/dashboard/patients/[id]": ["./node_modules/@sparticuz/chromium/bin/**"],
  },
  devIndicators: { position: "bottom-right" },
  experimental: {
    // Keep recently opened pages so going back is instant.
    staleTimes: { dynamic: 30, static: 60 },
    // Progress photos and meal photos are uploaded via Server Actions.
    serverActions: { bodySizeLimit: "6mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
