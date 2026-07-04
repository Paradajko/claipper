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
        cyan: {
          electric: "#22d3ee",
          deep: "#0891b2"
        }
      },
      boxShadow: {
        glow: "0 0 40px rgba(34, 211, 238, 0.18)",
        card: "0 18px 80px rgba(0, 0, 0, 0.42)"
      },
      backgroundImage: {
        "radial-cyan": "radial-gradient(circle at top right, rgba(34,211,238,.22), transparent 36%)"
      }
    }
  },
  plugins: []
};

export default config;
