import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Google OAuth avatars
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      // GitHub OAuth avatars
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      // Gravatar
      {
        protocol: 'https',
        hostname: '*.gravatar.com',
      },
      // Generic Supabase storage (if you use it for avatars)
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
};

export default nextConfig;
