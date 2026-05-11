import type { NextConfig } from "next";

const liveKitUrl =
  process.env.NEXT_PUBLIC_LIVEKIT_URL ?? process.env.LIVEKIT_URL;

const appUrl = process.env.NEXT_PUBLIC_APP_URL;
const appHostname = appUrl ? new URL(appUrl).hostname : undefined;

const nextConfig: NextConfig = {
  allowedDevOrigins: appHostname ? [appHostname] : undefined,
  env: liveKitUrl
    ? {
        NEXT_PUBLIC_LIVEKIT_URL: liveKitUrl,
      }
    : undefined,
};

export default nextConfig;
