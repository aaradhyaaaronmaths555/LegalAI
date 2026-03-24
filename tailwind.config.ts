import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#f6f7f9",
          100: "#eceef2",
          200: "#d5dae2",
          300: "#b1bac9",
          400: "#8794ab",
          500: "#687690",
          600: "#535f76",
          700: "#444d61",
          800: "#3b4252",
          900: "#343a47",
          950: "#22262f",
        },
        parchment: "#faf8f5",
        seal: "#8b4513",
        gold: "#c9a227",
      },
      fontFamily: {
        serif: ["var(--font-cormorant)", "Georgia", "serif"],
        sans: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
