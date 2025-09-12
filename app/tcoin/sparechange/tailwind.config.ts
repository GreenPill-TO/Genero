import path from "path";
import type { Config } from "tailwindcss";
import preset from "../../../tailwind.preset";

const config: Config = {
  presets: [preset],
  content: [
    path.join(__dirname, "./**/*.{js,ts,jsx,tsx,mdx}"),
    path.join(__dirname, "../../../shared/**/*.{js,ts,jsx,tsx,mdx}"),
  ],
};

export default config;

