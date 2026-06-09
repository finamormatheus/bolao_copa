import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        // Logos dos times da football-data.org
        protocol: "https",
        hostname: "crests.football-data.org",
      },
      {
        // Avatares do Google OAuth
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
};

export default nextConfig;
