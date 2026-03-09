import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig(async () => {
  const tsconfigPaths = (await import("vite-tsconfig-paths")).default;
  return {
    plugins: [tsconfigPaths()],
    test: {
      environment: "jsdom",
      setupFiles: ["./vitest.setup.ts"],
      exclude: [...configDefaults.exclude, "contracts/foundry/lib/**"],
    },
  };
});
