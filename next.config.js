const path = require("path");

const citycoin = process.env.NEXT_PUBLIC_CITYCOIN || "tcoin"; // Default CityCoin
const appToServe = process.env.NEXT_PUBLIC_APP_NAME || "wallet"; // Default app if not set

console.log(`Serving ${appToServe} for ${citycoin}`);

function hostnameFromUrl(value) {
  if (!value || typeof value !== "string") {
    return null;
  }

  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}

const supabaseImageHostnames = Array.from(
  new Set(
    [
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_TCOIN_BANNER_LIGHT_URL,
      process.env.NEXT_PUBLIC_TCOIN_BANNER_DARK_URL,
      ...(process.env.NEXT_PUBLIC_SUPABASE_IMAGE_URLS || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    ]
      .map(hostnameFromUrl)
      .filter(Boolean)
  )
);

const explicitWalletRootRoutes = [
  "dashboard",
  "merchant",
  "admin",
  "city-manager",
  "city-admin",
  "welcome",
  "resources",
  "contact",
  "ecosystem",
];

function rootWalletRewrite(route) {
  return [
    {
      source: `/${route}`,
      destination: `/${citycoin}/${appToServe}/${route}`,
    },
    {
      source: `/${route}/:path*`,
      destination: `/${citycoin}/${appToServe}/${route}/:path*`,
    },
  ];
}

const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: supabaseImageHostnames.map((hostname) => ({
      protocol: "https",
      hostname,
      pathname: "/**",
    })),
  },
  // No redirect; instead, directly serve from base URL
  async rewrites() {
    return [
      {
        source: "/",
        destination: `/${citycoin}/${appToServe}`, // Serve the main app at the root
      },
      ...explicitWalletRootRoutes.flatMap(rootWalletRewrite),
      {
        // Keep API routes in the app root namespace; rewrite only non-API paths.
        source: "/:path((?!api(?:/|$)).*)",
        destination: `/${citycoin}/${appToServe}/:path*`, // Rewrite all other requests to the app
      },
    ];
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      const webpack = require("webpack");
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
