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
        github: {
          dark: "#0d1117",
          "dark-border": "#30363d",
          "dark-hover": "#161b22",
          green: "#238636",
          "green-hover": "#2ea043",
        },
        mood: {
          1: "#ebedf0",
          2: "#9be9a8",
          3: "#40c463",
          4: "#30a14e",
          5: "#216e39",
        },
      },
    },
  },
  plugins: [],
};
export default config;

