/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        focus: {
          DEFAULT: '#ef4444',
          light: '#fca5a5',
          dark: '#dc2626'
        },
        break: {
          DEFAULT: '#10b981',
          light: '#6ee7b7',
          dark: '#059669'
        }
      },
      gridTemplateColumns: {
        '15': 'repeat(15, minmax(0, 1fr))',
      }
    },
  },
  plugins: [],
}
