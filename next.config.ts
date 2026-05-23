import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse 和 mammoth 依赖 Node.js 原生模块，不能被 webpack 打包
  serverExternalPackages: ["pdf-parse", "mammoth"],
  async redirects() {
    return [
      { source: "/", destination: "/landing", permanent: false },
    ];
  },
};

export default nextConfig;
