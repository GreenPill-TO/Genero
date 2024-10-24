const city = process.env.NEXT_PUBLIC_CITY || "toronto"; // Default city
const appToServe = process.env.NEXT_PUBLIC_APP_NAME || "TCoin"; // Default app if not set

console.log(`Serving ${appToServe} for ${city}`);

const nextConfig = {
  // No redirect; instead, directly serve from base URL
  async rewrites() {
    return [
      {
        source: "/",
        destination: `/${city}/${appToServe}`, // Serve the main app at the root
      },
      {
        source: "/:path*",
        destination: `/${city}/${appToServe}/:path*`, // Rewrite all other requests to the app
      },
    ];
  },
};

module.exports = nextConfig;
