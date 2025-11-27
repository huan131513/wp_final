import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  transpilePackages: ['@prisma/client', '.prisma/client'],
};

export default nextConfig;
