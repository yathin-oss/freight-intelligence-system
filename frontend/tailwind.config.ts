import type { Config } from "tailwindcss";

// Every base/white/black color below resolves through a CSS custom property
// (defined in globals.css under :root for light and .dark for dark) instead
// of a literal hex value, so existing class names (bg-base-900, text-white,
// border-white/[0.06], etc.) automatically theme-switch with zero changes to
// the components that already use them. Only `ink` is a fixed, non-flipping
// near-black - used for text that must stay dark regardless of theme (e.g.
// text on a bright accent-colored button).
//
// tailwindcss's own Config type doesn't model function-valued colors even
// though the runtime fully supports them (a long-standing gap in their
// bundled .d.ts) - hence the `any` cast, not a real type-safety loss here.
function withOpacity(variableName: string): any {
  return ({ opacityValue }: { opacityValue?: string }) => {
    if (opacityValue === undefined) return `rgb(var(${variableName}))`;
    return `rgb(var(${variableName}) / ${opacityValue})`;
  };
}

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        white: withOpacity("--c-white"),
        black: withOpacity("--c-black"),
        ink: withOpacity("--c-ink"),
        base: {
          950: withOpacity("--c-base-950"),
          900: withOpacity("--c-base-900"),
          850: withOpacity("--c-base-850"),
          800: withOpacity("--c-base-800"),
          750: withOpacity("--c-base-750"),
          700: withOpacity("--c-base-700"),
          600: withOpacity("--c-base-600"),
          500: withOpacity("--c-base-500"),
          100: withOpacity("--c-base-100"),
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
