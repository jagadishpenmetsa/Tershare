import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@tershare/protocol"],
  devIndicators: false,
};

export default nextConfig;
