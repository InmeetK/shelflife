import type { NextConfig } from "next";

// cacheComponents / partialPrefetching were scaffold defaults; turned off so
// cookie-authenticated Server Components render dynamically without Suspense
// boilerplate, and fetch `next.revalidate` keeps its classic behaviour.
const nextConfig: NextConfig = {
  // Dev badge overlaps the bottom-fixed Scan button in e2e screenshots.
  devIndicators: false,
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
