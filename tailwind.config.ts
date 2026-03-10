import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./apps/dashboard/app/**/*.{js,ts,jsx,tsx,mdx}", "./apps/dashboard/lib/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {},
  },
  plugins: [],
};
export default config;
