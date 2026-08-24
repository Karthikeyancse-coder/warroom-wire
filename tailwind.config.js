/** @type {import("tailwindcss").Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      colors: {
        brand: {
          50:  "#f0f9ff",
          100: "#e0f2fe",
          200: "#bae6fd",
          300: "#7dd3fc",
          400: "#38bdf8",
          500: "#0ea5e9",
          600: "#0284c7",
          700: "#0369a1",
          800: "#075985",
          900: "#0c4a6e",
          950: "#082f49",
        },
        surface: {
          DEFAULT: "var(--surface)",
          subtle:  "var(--surface-subtle)",
          muted:   "var(--surface-muted)",
          border:  "var(--surface-border)",
        },
        danger: { DEFAULT: "#f85149", muted: "#3d1f1f" },
        warn:   { DEFAULT: "#e3b341", muted: "#3d2f00" },
        ok:     { DEFAULT: "#10b981", muted: "#064e3b" },
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4,0,0.6,1) infinite",
        "slide-in":   "slideIn 0.3s ease-out",
        "fade-in":    "fadeIn 0.4s ease-out",
      },
      keyframes: {
        slideIn: {
          "0%":   { transform: "translateY(-8px)", opacity: "0" },
          "100%": { transform: "translateY(0)",    opacity: "1" },
        },
        fadeIn: {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};