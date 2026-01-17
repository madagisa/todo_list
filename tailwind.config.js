/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        kepco: {
          navy: '#0A192F', // Deep Navy (Background/Primary Text)
          blue: '#0054FF', // Electric Blue (Primary Action)
          light: '#E6EBF5', // Light Blue/Gray (Background)
          gray: '#8892B0', // Muted Text
          white: '#FFFFFF',
          glass: 'rgba(255, 255, 255, 0.1)',
        }
      },
      fontFamily: {
        sans: ['Pretendard', 'Inter', 'sans-serif'],
        heading: ['Montserrat', 'sans-serif'],
      },
      boxShadow: {
        'glass': '0 4px 30px rgba(0, 0, 0, 0.1)',
        'neon': '0 0 10px rgba(0, 84, 255, 0.5)',
      }
    },
  },
  plugins: [],
}
