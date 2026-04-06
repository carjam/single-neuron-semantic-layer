import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Monorepo / parent lockfiles: trace files from this app root
  outputFileTracingRoot: path.join(__dirname),
  transpilePackages: ["swagger-ui-react"],
};

export default nextConfig;
