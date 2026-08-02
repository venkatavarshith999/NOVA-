/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        void: {
          950: "#06070d",
          900: "#0b0e1a",
          800: "#12162a",
          700: "#1a1f38",
          600: "#242a4a",
        },
        violet: {
          400: "#a78bfa",
          500: "#8b5cf6",
          600: "#7c3aed",
          700: "#6d28d9",
        },
        azure: {
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
        },
        cyan: {
          300: "#67e8f9",
          400: "#22d3ee",
        },
        mint: {
          400: "#34d399",
          500: "#10b981",
        },
        amber: {
          400: "#fbbf24",
        },
        coral: {
          400: "#fb7185",
        },
      },
      fontFamily: {
        display: ["Space Grotesk", "sans-serif"],
        body: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      backgroundImage: {
        "nova-gradient": "linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%)",
        "nova-gradient-soft": "linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(59,130,246,0.15) 100%)",
        "nova-radial": "radial-gradient(ellipse at top, #1a1f38 0%, #06070d 60%)",
      },
      boxShadow: {
        glow: "0 0 40px rgba(124,58,237,0.25)",
        "glow-cyan": "0 0 30px rgba(34,211,238,0.25)",
      },
      animation: {
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        float: "float 6s ease-in-out infinite",
        drift: "drift 20s linear infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-12px)" },
        },
        drift: {
          "0%": { transform: "translate(0,0)" },
          "50%": { transform: "translate(-20px, 15px)" },
          "100%": { transform: "translate(0,0)" },
        },
      },
    },
  },
  plugins: [],
}
