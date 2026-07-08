import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      colors: {
        // Flat-Premium design system — Pitch black base
        background: "#000000",
        foreground: "#ffffff",
        // Emerald accent — successful composition match
        emerald: {
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
        },
        // Amber — warning / near-miss threshold
        amber: {
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
        },
        // Zinc structural borders — module separators
        zinc: {
          800: "#27272a",
          850: "#1f1f22",
          900: "#18181b",
          950: "#09090b",
        },
      },
      borderColor: {
        DEFAULT: "#27272a", // zinc-800 as default border
      },
      keyframes: {
        // Subtle pulse for the camera capture button only
        "capture-pulse": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(16, 185, 129, 0.4)" },
          "50%": { boxShadow: "0 0 0 8px rgba(16, 185, 129, 0)" },
        },
        // Fade-in for page entry (opacity only — no transforms on mobile camera viewport)
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        // Skeleton shimmer for loading states
        shimmer: {
          "0%": { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" },
        },
      },
      animation: {
        "capture-pulse": "capture-pulse 2s ease-in-out infinite",
        "fade-in": "fade-in 0.3s ease-out",
        shimmer: "shimmer 1.5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
