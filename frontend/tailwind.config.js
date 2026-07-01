/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: "#0F172A",
          accent: "#3B82F6",
          accentHover: "#2563EB",
          cardBg: "rgba(30, 41, 59, 0.7)",
        }
      }
    },
  },
  plugins: [],
}
