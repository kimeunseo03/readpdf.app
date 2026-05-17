import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse는 CJS 모듈로 Next.js 번들러와 충돌 → 외부 패키지로 처리
  serverExternalPackages: ["pdf-parse"],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb"
    }
  }
};

export default nextConfig;
