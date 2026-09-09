import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        base: {
          950: "#05070a",
          900: "#0a0e14",
          850: "#0d121a",
          800: "#111826",
          750: "#151d2c",
          700: "#1b2436",
          600: "#26314a",
          500: "#3a4a68",
        },
        accent: {
          cyan: "#3dd6c8",
          blue: "#4c8dff",
          amber: "#e8a33d",
          rose: "#e8607a",
        },
        risk: {
          low: "#3dd68c",
          medium: "#e8a33d",
          high: "#e8607a",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        panel: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 0 0 1px rgba(255,255,255,0.04)",
      },
    },
  },
  plugins: [],
};

export default config;
