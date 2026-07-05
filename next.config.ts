import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/stream-scan/**/*": ["./node_modules/youtube-dl-exec/bin/yt-dlp"]
  }
};

export default nextConfig;
