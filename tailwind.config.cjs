/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./web/**/*.{html,js}", "./src/**/*.ts"],
  darkMode: "media",
  theme: {
    extend: {
      colors: {
        primary: "#192B60",
        secondary: "#111E45",
        tertiary: "#E8ECF5",
        danger: "#EB2323",
        info: "#192B60",
        success: "#28B84A"
      },
      boxShadow: {
        soft: "0 8px 24px rgba(25, 43, 96, 0.10)"
      }
    }
  },
  plugins: []
};
