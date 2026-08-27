import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The development indicator overlaps the 320px bottom navigation during
  // fixture-only browser runs. Keep it for normal local development.
  devIndicators: process.env.E2E === 'true' ? false : undefined,
};

export default nextConfig;
