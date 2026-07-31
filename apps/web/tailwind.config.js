/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#5C397D", // Deep Iris
          dark: "#46285F",
          light: "#7E5BA6",
        },
        accent: {
          DEFAULT: "#F99E29", // Carrot Orange
          soft: "#FDE7C7",
        },
        capri: {
          DEFAULT: "#00C1FF", // Capri Blue
          soft: "#D6F4FF",
        },
        coral: "#E0484E",
        ink: "#241B30",
        muted: "#6B6275",
        surface: "#FFFFFF",
        canvas: "#F4F0F8",
        soft: "#EFEAF3",
        line: "#E4DEEC",
      },
      borderRadius: {
        xl: "1.1rem",
        "2xl": "1.4rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(30,42,42,0.04), 0 8px 24px rgba(30,42,42,0.06)",
        lift: "0 8px 30px rgba(92,57,125,0.18)",
      },
    },
  },
  plugins: [],
};
