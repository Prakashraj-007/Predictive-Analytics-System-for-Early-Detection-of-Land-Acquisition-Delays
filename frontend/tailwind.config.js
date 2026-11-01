/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // "INNER PEACE" Palette from Lecture/Video Swatches
        mocha: {
          DEFAULT: '#5B4632', // Mocha Brown (#5B4632)
          950: '#140F0B',     // Deep Canvas
          900: '#1A130E',
          850: '#201812',     // Primary Panel
          800: '#2A1F18',     // Card Surface
          750: '#35271E',     // Elevated Card
          700: '#433226',
          600: '#5B4632',     // Swatch Mocha Brown
          500: '#73583F',
          400: '#8E6E50',
        },
        champagne: {
          DEFAULT: '#F4D9A0', // Champagne Gold (#F4D9A0)
          light: '#FBF0D8',
          hover: '#ECD091',
          500: '#F4D9A0',
          600: '#E2C382',
          700: '#C8A866',
        },
        amber: {
          burnt: '#C8792C',   // Burnt Amber (#C8792C)
          hover: '#D88636',
          active: '#B56A23',
        },
        peace: {
          bg: '#140F0B',
          surface: '#1E1611',
          card: '#241B14',
          elevated: '#2E231A',
          border: 'rgba(244, 217, 160, 0.12)',
          'border-gold': 'rgba(244, 217, 160, 0.28)',
          'text-gold': '#F4D9A0',
          'text-ivory': '#F3EDE2',
          'text-sand': '#C4B5A5',
          'text-taupe': '#8E7E70',
        },
        risk: {
          low: '#4A855A',
          medium: '#C8792C',
          high: '#C94A3D',
        },
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        headline: ['"Cinzel"', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '6px',
        'md': '8px',
        'lg': '10px',
      },
    },
  },
  plugins: [],
};
