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
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "qris-modal": "qris-modal 0.32s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        "qris-check": "qris-check 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.08s both",
        "qris-sheet": "qris-sheet 0.38s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        "fade-up": "fade-up 0.4s cubic-bezier(0.22, 1, 0.36, 1) both",
      },
      colors: {
        sidebar: {
          DEFAULT: "#0B1526",
          dark: "#060B12",
          hover: "#152338",
          active: "#1C3148",
        },
        accent: {
          DEFAULT: "#0D6E5F",
          dark: "#2BA890",
          light: "#E6F4F1",
        },
        school: {
          navy: "#0B1526",
          teal: "#0D6E5F",
          gold: "#B8956C",
        },
      },
      fontFamily: {
        serif: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
