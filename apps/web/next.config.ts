import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  // The browser tests run their own dev server next to the normal one; a separate
  // output folder keeps the two from fighting over `.next`.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default nextConfig;
