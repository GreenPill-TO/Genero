// next.config.ts
import dotenv from 'dotenv';
import { NextConfig } from 'next';

// Load environment variables from .env.local
dotenv.config();

const citycoin = process.env.NEXT_PUBLIC_CITYCOIN || 'tcoin';
const appEnv = process.env.NEXT_PUBLIC_APP_NAME || 'sparechange';

console.log(`Starting Next.js server for: ${citycoin} - ${appEnv}`);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  productionBrowserSourceMaps: true,
  webpack(config, { webpack }) {
    // Embed environment variables into the code for middleware
    config.plugins.push(
      new webpack.DefinePlugin({
        'process.env.NEXT_PUBLIC_CITYCOIN': JSON.stringify(process.env.NEXT_PUBLIC_CITYCOIN),
        'process.env.NEXT_PUBLIC_APP_NAME': JSON.stringify(process.env.NEXT_PUBLIC_APP_NAME),
      })
    );
    return config;
  },
  // Remove rewrites if using middleware
};

export default nextConfig;
