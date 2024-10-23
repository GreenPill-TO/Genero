/** @type {import('next').NextConfig} */

const city = process.env.NEXT_PUBLIC_CITY || "toronto"; // Default city
const appToServe = process.env.NEXT_PUBLIC_APP_NAME || "tcoin"; // Default app if not set

console.log(`Serving ${appToServe} for ${city}`);

const nextConfig = {
  // No redirect; instead, directly serve from base URL
  async rewrites() {
    return [
      {
        source: "/",
        destination: `/${city}/${appToServe}/app`, // Serve the main app at the root
      },
      {
        source: "/:path*",
        destination: `/${city}/${appToServe}/app/:path*`, // Rewrite all other requests to the app
      },
    ];
  },
};

export default nextConfig;
