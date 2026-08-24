import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/VISOR-REPOSITORIO-DIGITAL",
  assetPrefix: "/VISOR-REPOSITORIO-DIGITAL/",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
