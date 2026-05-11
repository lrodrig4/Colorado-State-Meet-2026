import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Keep webpack in-process; local macOS native-addon loading can deadlock
    // the build worker before it reports an actionable error.
    webpackBuildWorker: false,
  },
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
