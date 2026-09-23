import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloud Run 用の Docker イメージを小さくする (Dockerfile 参照)
  output: "standalone",
  experimental: {
    // 書類写真の複数枚アップロード用 (クライアント側で圧縮した上で送信する)
    serverActions: { bodySizeLimit: "20mb" },
    proxyClientMaxBodySize: "20mb",
  },
};

export default nextConfig;
