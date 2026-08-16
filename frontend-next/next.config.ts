import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Proxy all /api requests to the existing FastAPI backend (port 8000)
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:8000/api/:path*",
      },
    ];
  },
  // R3F / drei need these to be transpiled in Next.js
  transpilePackages: ["three", "@react-three/fiber", "@react-three/drei"],
  // Allow importing 3D assets
  webpack(config) {
    config.module.rules.push({
      test: /\.(glb|gltf|hdr)$/,
      type: "asset/resource",
    });
    return config;
  },
};

export default nextConfig;
