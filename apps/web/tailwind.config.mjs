/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Mona Sans', 'system-ui', 'sans-serif'],
        inter: ['Mona Sans', 'system-ui', 'sans-serif'],
        lato: ['Mona Sans', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#FF8A00',
          light: '#FFB347',
        },
        ink: '#111315',
        'base-grey': '#F3F4F6',
      },
      borderColor: {
        strong: 'rgba(26, 29, 33, 0.3)',
      },
      backgroundImage: {
        'primary-gradient': 'linear-gradient(118.29deg, #FF8A00 38.71%, #FFB347 88.95%)',
      },
      // No `forwards` fill: each animation ends at the element's natural state
      // anyway, and a filling opacity/transform animation keeps the element a
      // stacking context (and, for transforms, a containing block) for good.
      // The dashboard wraps every page in animate-fade-in, which pinned every
      // modal opened inside a page — even at z-[1000] — underneath the shell's
      // header, footer and sidebar.
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-in-bottom': 'slideInBottom 0.5s ease-out',
        'zoom-in': 'zoomIn 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideInBottom: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        zoomIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
