/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0a0a0f",
        accent: "#e8ff47",
        nba: "#4a7fff",
        soccer: "#39d353",
      },
      fontFamily: {
        sans: ["'JetBrains Mono'", "ui-monospace", "monospace"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      borderRadius: { DEFAULT: "3px", sm: "2px", md: "4px" },
    },
  },
  plugins: [],
};
