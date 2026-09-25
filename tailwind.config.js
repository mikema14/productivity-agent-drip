import { COLOR } from './src/theme/tokens.js';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Outfit', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
        condensed: ['Barlow Condensed', 'JetBrains Mono', 'sans-serif'],
      },
      letterSpacing: {
        label: '1.5px',
      },
      colors: {
        drip: COLOR.drip,
        focus: {
          ...COLOR.focus,
          glow: 'rgba(245, 158, 11, 0.15)',
          muted: 'rgba(245, 158, 11, 0.1)',
        },
        break: {
          ...COLOR.break,
          glow: 'rgba(52, 211, 153, 0.15)',
          muted: 'rgba(52, 211, 153, 0.1)',
        },
        idle: {
          DEFAULT: '#64748b',
        },
        txt: COLOR.txt,
      },
      boxShadow: {
        'glow-focus': '0 0 40px rgba(245, 158, 11, 0.15), 0 0 80px rgba(245, 158, 11, 0.05)',
        'glow-break': '0 0 40px rgba(52, 211, 153, 0.15), 0 0 80px rgba(52, 211, 153, 0.05)',
        'glow-idle': '0 0 40px rgba(100, 116, 139, 0.1)',
        'glass': '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.03)',
        'glass-sm': '0 4px 16px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.03)',
        // Physical keycap buttons and the 4px LED squares of the Now screen
        'key-amber': `0 3px 0 ${COLOR.focus.shadow}, inset 0 1px 0 rgba(255,255,255,0.35)`,
        'key-dark': '0 3px 0 #000',
        'key-sm': '0 2px 0 #000',
        'led': '0 0 5px rgba(245,158,11,0.8)',
      },
      animation: {
        'glow-breathe': 'glow-breathe 4s ease-in-out infinite',
        'fade-in': 'fade-in 0.3s ease-out',
        'fade-in-up': 'fade-in-up 0.4s ease-out',
        'scale-in': 'scale-in 0.3s ease-out',
      },
      keyframes: {
        'glow-breathe': {
          '0%, 100%': { opacity: '0.6', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.05)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      gridTemplateColumns: {
        '15': 'repeat(15, minmax(0, 1fr))',
      },
    },
  },
  plugins: [],
}
