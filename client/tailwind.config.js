/** @type {import('tailwindcss').Config} */
import tailwindcssAnimate from "tailwindcss-animate"

export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        brand: {
          50: "#e5f7f5",
          100: "#bfe9e2",
          200: "#99dacc",
          300: "#73cbb6",
          400: "#4dbda0",
          500: "#1DAA97", // Updated to your desired green
          600: "#1a9887",
          700: "#16786a",
          800: "#125a50",
          900: "#0e3d36",
        },
        coral: { 50: "#fff1ed", 100: "#ffe0d7", 500: "#e85d3f", 600: "#cc452b", 700: "#a93624" },
      },
      boxShadow: {
        "glow-brand": "0 0 60px rgba(29, 170, 151, 0.6)", // Adjusted glow color
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};
