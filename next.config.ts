import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@vladmandic/face-api"],
  turbopack: {
    resolveAlias: {
      // face-api.js / tfjs references these node built-ins — alias to empty in browser
      fs: { browser: "./lib/empty-module.js" },
      path: { browser: "./lib/empty-module.js" },
      crypto: { browser: "./lib/empty-module.js" }
    }
  }
};

export default nextConfig;
