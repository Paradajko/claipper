import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#05070b",
        panel: "#0b1018",
        line: "rgba(148, 163, 184, 0.18)",
        brand: {
          electric: "#10b981",
          deep: "#059669"
        }
      },
      boxShadow: {
        glow: "0 0 40px rgba(16, 185, 129, 0.18)",
        card: "0 18px 80px rgba(0, 0, 0, 0.42)"
      },
      backgroundImage: {
        "radial-emerald": "radial-gradient(circle at top right, rgba(16,185,129,.22), transparent 36%)"
      }
    }
  },
  plugins: []
};

export default config;
