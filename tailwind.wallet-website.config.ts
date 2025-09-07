import baseConfig from "./tailwind.config";
import type { Config } from "tailwindcss";

const config: Config = {
  ...baseConfig,
  theme: {
    ...baseConfig.theme,
    extend: {
      ...(baseConfig.theme?.extend || {}),
      fontFamily: {
        ...(baseConfig.theme?.extend?.fontFamily || {}),
        sans: ["'Special Elite'", "monospace"],
      },
    },
  },
};

export default config;
