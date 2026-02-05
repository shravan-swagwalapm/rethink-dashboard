import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Allow large file uploads (100MB) for PDF presentations/documents
      bodySizeLimit: '100mb',
    },
  },
};

export default nextConfig;
