import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@tershare/protocol"],
  devIndicators: false,
  async redirects() {
    return [
      {
        source: "/install.bat",
        destination: "https://github.com/jagadishpenmetsa/Tershare/raw/main/apps/web/public/install.bat",
        permanent: false,
      },
      {
        source: "/install",
        destination: "https://github.com/jagadishpenmetsa/Tershare/raw/main/apps/web/public/install.ps1",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
