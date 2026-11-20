import { withReticle } from '@reticlehq/next';
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // sharp + pdfjs are server-side only; keep them out of the client bundle
  serverExternalPackages: ["sharp", "pdfjs-dist", "@napi-rs/canvas", "pg"],
  images: { unoptimized: true },
  experimental: {
    serverActions: { bodySizeLimit: "20mb" },
  },
};

export default withReticle(nextConfig);
