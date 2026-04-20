/** @type {import('tailwindcss').Config} */
export default {
  content: [
  "./index.html",
  "./src/**/*.{js,jsx}",
  "./src/Pages/**/*.{js,jsx}",
  "./src/components/**/*.{js,jsx}",
  "./src/context/**/*.{js,jsx}",
],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        poiret: ['"Poiret One"', 'cursive'],
        vidaloka: ['Vidaloka', 'serif'],
        raleway: ['Raleway', 'serif'],
        anton: ['Anton', 'serif'],
      },
      colors: {
        pinky: "#F7C8D3",
        cream: "#FFF1C1",
        yarn: "#6B4E71",
        text: "#3A3A3A",
        // dark mode equivalents
        "cream-dark": "#1e1a2e",
        "yarn-dark": "#c4a8cc",
        "text-dark": "#e8e0f0",
        "surface-dark": "#2a2438",
        "border-dark": "#3d3050",
      },
    },
  },
  plugins: [],
};