import os from "os";
import type { NextConfig } from "next";

function lanHosts() {
  const hosts = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "67.217.59.81"]);
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.address) hosts.add(a.address);
    }
  }
  return [...hosts];
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,
  serverExternalPackages: ["bcryptjs", "jsonwebtoken", "pg"],
  allowedDevOrigins: lanHosts(),
  experimental: {
    proxyClientMaxBodySize: "100mb",
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "Permissions-Policy", value: "autoplay=*, fullscreen=*" }],
      },
    ];
  },
};

export default nextConfig;
