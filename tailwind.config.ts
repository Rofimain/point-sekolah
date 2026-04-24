import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        sidebar: {
          DEFAULT: "#1A2340",
          dark: "#0D1320",
          hover: "#253156",
          active: "#2E3D6A",
        },
        accent: {
          DEFAULT: "#2E4FBF",
          dark: "#4A6FE0",
          light: "#EEF2FF",
        },
        school: {
          navy: "#1A2340",
          blue: "#2E4FBF",
        },
      },
      fontFamily: {
        serif: ["Georgia", "Cambria", "serif"],
        sans: ["system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
