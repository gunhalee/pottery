import type { NextConfig } from "next";

const supabaseImageHostname = getSupabaseImageHostname();

const nextConfig: NextConfig = {
  images: {
    deviceSizes: [640, 768, 1024, 1280, 1536, 1920],
    formats: ["image/avif", "image/webp"],
    imageSizes: [32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31536000,
    qualities: [70, 75],
    remotePatterns: [
      ...(supabaseImageHostname
        ? [
            {
              hostname: supabaseImageHostname,
              pathname: "/storage/v1/object/public/media-assets/**",
              protocol: "https" as const,
            },
          ]
        : []),
      {
        hostname: "i.ytimg.com",
        pathname: "/vi/**",
        protocol: "https",
      },
    ],
  },
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  async headers() {
    return [
      {
        source: "/asset/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

function getSupabaseImageHostname() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

  if (!rawUrl) {
    return undefined;
  }

  try {
    return new URL(rawUrl).hostname;
  } catch {
    return undefined;
  }
}
