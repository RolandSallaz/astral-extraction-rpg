import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  transpilePackages: ["@mmorpg/shared"],
  experimental: {
    externalDir: true,
  },
  turbopack: {
    root: path.resolve(currentDir, ".."),
  },
};

export default nextConfig;
