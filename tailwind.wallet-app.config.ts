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
        sans: ["Poppins", "sans-serif"],
        heading: ["Montserrat", "sans-serif"],
      },
    },
  },
};

export default config;
