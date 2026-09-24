/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/renderer/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans:  ['Mona Sans', 'system-ui', 'sans-serif'],
        inter: ['Mona Sans', 'system-ui', 'sans-serif'], // keeps font-inter class working
        lato:  ['Mona Sans', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'xs':   ['0.76rem',  { lineHeight: '1.15rem' }],  // ~13px  (was 12px)
        'sm':   ['0.9rem',   { lineHeight: '1.4rem'  }],  // ~15px  (was 14px)
        'base': ['1rem',     { lineHeight: '1.6rem'  }],  // ~17px  (base scaled)
        'lg':   ['1.1rem',   { lineHeight: '1.75rem' }],  // ~19px
        'xl':   ['1.25rem',  { lineHeight: '1.85rem' }],  // ~21px
        '2xl':  ['1.47rem',  { lineHeight: '2rem'    }],  // ~25px
        '3xl':  ['1.76rem',  { lineHeight: '2.2rem'  }],  // ~30px
        '4xl':  ['2.12rem',  { lineHeight: '2.5rem'  }],  // ~36px
        '5xl':  ['2.82rem',  { lineHeight: '1'       }],  // ~48px
        '6xl':  ['3.53rem',  { lineHeight: '1'       }],
        '7xl':  ['4.24rem',  { lineHeight: '1'       }],
      },
    },
  },
  plugins: [],
}
