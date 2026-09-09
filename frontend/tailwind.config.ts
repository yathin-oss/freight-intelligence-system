import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      // Every color below is a CSS variable (see globals.css :root / .dark),
      // expressed with Tailwind's `rgb(var(--x) / <alpha-value>)` pattern so
      // arbitrary opacity modifiers (bg-base-900/50, border-accent-gold/30,
      // ...) keep working exactly as before. Component code never changes
      // between light/dark - only the variable values do.
      colors: {
        base: {
          950: "rgb(var(--c-base-950) / <alpha-value>)",
          900: "rgb(var(--c-base-900) / <alpha-value>)",
          850: "rgb(var(--c-base-850) / <alpha-value>)",
          800: "rgb(var(--c-base-800) / <alpha-value>)",
          750: "rgb(var(--c-base-750) / <alpha-value>)",
          700: "rgb(var(--c-base-700) / <alpha-value>)",
          600: "rgb(var(--c-base-600) / <alpha-value>)",
          500: "rgb(var(--c-base-500) / <alpha-value>)",
          100: "rgb(var(--c-base-100) / <alpha-value>)",
        },
        accent: {
          // Brand accent - warm amber/gold ("Bloomberg terminal", not cyan
          // SaaS). Key kept as `gold` (renamed from the original `cyan`)
          // throughout the app.
          gold: "rgb(var(--c-gold) / <alpha-value>)",
          blue: "rgb(var(--c-info) / <alpha-value>)",
          // Caution/warning amber - intentionally a distinct hue from the
          // brand gold above so "primary action" and "medium risk" never
          // read as the same color.
          amber: "rgb(var(--c-warn) / <alpha-value>)",
          rose: "rgb(var(--c-danger) / <alpha-value>)",
          violet: "rgb(var(--c-violet) / <alpha-value>)",
        },
        risk: {
          low: "rgb(var(--c-good) / <alpha-value>)",
          medium: "rgb(var(--c-warn) / <alpha-value>)",
          high: "rgb(var(--c-danger) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        // Terminal-grade panels separate with a hairline border, not a glow -
        // this shadow is intentionally almost nothing, kept only so a panel
        // reads as very slightly raised against the page background.
        panel: "0 1px 0 0 rgba(255,255,255,0.03) inset",
      },
      borderRadius: {
        // Sharpen every radius scale step site-wide (2-4px, not the 8-12px
        // "generic SaaS card" default) without having to touch every
        // component that uses rounded-md/lg/xl.
        DEFAULT: "3px",
        sm: "2px",
        md: "3px",
        lg: "4px",
        xl: "4px",
        "2xl": "4px",
        "3xl": "4px",
      },
    },
  },
  plugins: [],
};

export default config;
