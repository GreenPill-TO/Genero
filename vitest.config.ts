import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "shared"),
      "@tcoin/wallet": path.resolve(__dirname, "app/tcoin/wallet"),
      "@tcoin/sparechange": path.resolve(__dirname, "app/tcoin/sparechange"),
    },
  },
});
