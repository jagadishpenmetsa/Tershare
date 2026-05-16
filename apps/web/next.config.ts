import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@tershare/protocol"],
  devIndicators: false,
  async rewrites() {
    return [
      {
        source: "/install",
        destination: "/install.ps1",
      },
    ];
  },
};

export default nextConfig;
