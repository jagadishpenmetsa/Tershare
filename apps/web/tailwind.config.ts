import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx,css}"],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#ffffff",
          elevated: "#fafafa",
          card: "#f5f5f5",
        },
        gold: {
          DEFAULT: "#B8860B",
          light: "#D4AF37",
          dark: "#8B6914",
        },
        glass: {
          border: "rgba(0, 0, 0, 0.1)",
          "border-strong": "rgba(0, 0, 0, 0.18)",
          bg: "rgba(0, 0, 0, 0.03)",
          hover: "rgba(0, 0, 0, 0.06)",
        },
      },
      fontFamily: {
        sans: ["var(--font-poppins)", "system-ui", "sans-serif"],
        brand: ["var(--font-brand)", "Impact", "sans-serif"],
        mono: ["ui-monospace", "Consolas", "monospace"],
      },
      backdropBlur: {
        glass: "20px",
      },
      boxShadow: {
        glass:
          "0 8px 32px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.9)",
        "glass-sm":
          "0 4px 16px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.8)",
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-out forwards",
        "slide-up": "slideUp 0.6s ease-out forwards",
        shimmer: "shimmer 3s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%, 100%": { opacity: "0.9" },
          "50%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
