import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@ledge/sdk", "@ledge/core"],
};

export default nextConfig;
