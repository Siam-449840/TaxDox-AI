import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Production builds MUST fail on TypeScript errors. The previous
  // ignoreBuildErrors:true masked real type regressions from reaching CI.
  reactStrictMode: false,
};

export default nextConfig;
