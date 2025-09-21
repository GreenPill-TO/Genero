const path = require("path");
const webpack = require("webpack");

const citycoin = process.env.NEXT_PUBLIC_CITYCOIN || "tcoin"; // Default CityCoin
const appToServe = process.env.NEXT_PUBLIC_APP_NAME || "wallet"; // Default app if not set

console.log(`Serving ${appToServe} for ${citycoin}`);

const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "osgpkjqbdbybbmhrfxnw.supabase.co",
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
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.resolve.alias = {
        ...(config.resolve.alias ?? {}),
        "cubid-wallet": path.resolve(__dirname, "shared/stubs/cubid-wallet.tsx"),
        "cubid-sdk": path.resolve(__dirname, "shared/stubs/cubid-sdk.tsx"),
        "cubid-wallet/dist/styles.css": path.resolve(
          __dirname,
          "shared/stubs/cubid-wallet.css"
        ),
        "cubid-sdk/dist/index.css": path.resolve(
          __dirname,
          "shared/stubs/cubid-sdk.css"
        ),
      };

      config.plugins = config.plugins || [];
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /cubid-wallet\/dist\/styles\.css/,
          path.resolve(__dirname, "shared/stubs/cubid-wallet.css")
        ),
        new webpack.NormalModuleReplacementPlugin(
          /cubid-sdk\/dist\/index\.css/,
          path.resolve(__dirname, "shared/stubs/cubid-sdk.css")
        )
      );
    }

    return config;
  },
};

module.exports = nextConfig;
