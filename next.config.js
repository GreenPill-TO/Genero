const citycoin = process.env.NEXT_PUBLIC_CITYCOIN || "tcoin"; // Default CityCoin
const appToServe = process.env.NEXT_PUBLIC_APP_NAME || "wallet"; // Default app if not set

console.log(`Serving ${appToServe} for ${citycoin}`);

const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cspyqrxxyflnuwzzzkmv.supabase.co",
        pathname: "/storage/v1/object/public/website-images/**",
      },
    ],
  },
  // No redirect; instead, directly serve from base URL
  async rewrites() {
    return [
      {
        source: "/",
        destination: `/${citycoin}/${appToServe}`, // Serve the main app at the root
      },
      {
        source: "/:path*",
        destination: `/${citycoin}/${appToServe}/:path*`, // Rewrite all other requests to the app
      },
    ];
  },
};

module.exports = nextConfig;
