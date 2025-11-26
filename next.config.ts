import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use standalone output for Electron builds
  // For Vercel deployment, this is ignored (Vercel uses its own settings)
  output: 'standalone',
};

export default nextConfig;
