import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@ledge/core", "@ledge/sdk"],
};

export default nextConfig;
