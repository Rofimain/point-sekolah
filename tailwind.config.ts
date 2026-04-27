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
      keyframes: {
        "qris-modal": {
          "0%": { opacity: "0", transform: "scale(0.94) translateY(16px)" },
          "100%": { opacity: "1", transform: "scale(1) translateY(0)" },
        },
        "qris-check": {
          "0%": { transform: "scale(0)", opacity: "0" },
          "55%": { transform: "scale(1.12)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "qris-sheet": {
          "0%": { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" },
        },
      },
      animation: {
        "qris-modal": "qris-modal 0.32s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        "qris-check": "qris-check 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.08s both",
        "qris-sheet": "qris-sheet 0.38s cubic-bezier(0.22, 1, 0.36, 1) forwards",
      },
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
