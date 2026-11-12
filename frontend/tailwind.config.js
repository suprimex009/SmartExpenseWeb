/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#090d18",
        panel: "#111827",
        elevated: "#151e2f",
        mint: "#8df0c2",
        muted: "#8792a8",
      },
      fontFamily: {
        sans: ["DM Sans", "sans-serif"],
        display: ["Manrope", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 42px rgba(141, 240, 194, 0.12)",
        card: "0 24px 70px rgba(0, 0, 0, 0.22)",
      },
    },
  },
  plugins: [],
};
