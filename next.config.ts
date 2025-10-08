import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  typescript:{
    ignoreBuildErrors: true,
  },
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  images: {
    // instead of "domains: […]"
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*',    // ← allow any HTTPS host :contentReference[oaicite:0]{index=0}
        // you can omit port and pathname to imply "**"
      },
    ],
  },
}


export default nextConfig;