import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,
  experimental: {
    // Inline small CSS chunks rather than extra HTTP fetches
    optimizeCss: false, // requires critters; leave off until dep is added
  },
  // Bundle server-only packages instead of loading them from node_modules at
  // runtime — shaves a few milliseconds off cold route renders on Hostinger.
  serverExternalPackages: [],
};

export default nextConfig;
