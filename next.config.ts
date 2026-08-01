import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    turbopack: {
        root: process.cwd(),
    },
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "bjdmkslrvujlrbqsvgmu.supabase.co",
                pathname: "/storage/v1/object/public/**",
            },
        ],
    },
    experimental: {
        serverActions: {
            allowedOrigins: ["155.212.138.235"], // IP вашего VPS
        },
    },
};

export default nextConfig;
