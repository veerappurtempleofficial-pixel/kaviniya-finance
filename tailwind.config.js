/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#14283F',
          dark: '#0E1D2F',
          light: '#1C3654',
        },
        brand: {
          DEFAULT: '#244B70',
          hover: '#1B3A59',
          light: '#EDF2F7',
        },
        surface: {
          DEFAULT: '#F7F8FA',
          muted: '#E8EDF2',
          border: '#D5DCE4',
        },
        teal: {
          DEFAULT: '#188A78',
          dark: '#136F60',
          light: '#EBF7F5',
        },
        gold: {
          DEFAULT: '#B78727',
          light: '#FBF6EB',
          border: '#E6D09C',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans Tamil', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
