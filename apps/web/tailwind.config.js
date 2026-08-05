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
        // Paleta oficial solicitada
        psi: {
          darkest: "#43265E",   // Hex #43265E - Roxo Escuro Profundo (Sidebar, Cards de Alto Contraste)
          deep: "#5C397D",      // Hex #5C397D - Roxo Principal (Botões primários, badges de destaque)
          vibrant: "#9E6BCF",   // Hex #9E6BCF - Roxo Médio/Vibrante (Accent, highlights, ícones)
          soft: "#EDE6F4",      // Hex #EDE6F4 - Lavanda Claro (Fundos sutis, hovers, chips)
          light: "#F9F5FC",     // Hex #F9F5FC - Off-white Iluminado (Canvas de fundo da plataforma)
        },
        primary: {
          DEFAULT: "#5C397D",
          dark: "#43265E",
          light: "#9E6BCF",
        },
        accent: {
          DEFAULT: "#9E6BCF",
          soft: "#EDE6F4",
        },
        capri: {
          DEFAULT: "#5C397D",
          soft: "#EDE6F4",
        },
        coral: {
          DEFAULT: "#F43F5E",
          light: "#FECDD3",
          dark: "#E11D48",
        },
        ink: "#1E1528",         // Tipografia escura de alto contraste
        muted: "#756785",       // Tipografia secundária
        surface: "#FFFFFF",     // Cards brancos
        canvas: "#F9F5FC",      // Fundo geral do app (#F9F5FC)
        soft: "#EDE6F4",       // Fundo suave de chips/hovers (#EDE6F4)
        line: "#F0E9F5",        // Bordas leves imperceptíveis
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.25rem',       // 20px - Levemente arredondado conforme imagem de referência
        '3xl': '1.5rem',
      },
      boxShadow: {
        // Sombras leves e suaves sem bordas pesadas (igual às dashboards de referência)
        card: "0 4px 20px rgba(67, 38, 94, 0.04), 0 1px 3px rgba(0, 0, 0, 0.02)",
        contrast: "0 10px 30px rgba(67, 38, 94, 0.18)",
        lift: "0 12px 28px rgba(92, 57, 125, 0.12)",
      },
      fontFamily: {
        sans: ['Inter Tight', 'Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
