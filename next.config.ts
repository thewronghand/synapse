import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use standalone output for Electron builds
  // For Vercel deployment, this is ignored (Vercel uses its own settings)
  output: 'standalone',
  serverExternalPackages: [
    "@mastra/core",
    "@mastra/voice-google",
    "@ai-sdk/google-vertex",
    "@google-cloud/speech",
    "@google-cloud/text-to-speech",
  ],
};

export default nextConfig;
