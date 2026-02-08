/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        'display-xl': ['clamp(2.5rem, 5vw + 1rem, 4rem)', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'display-2xl': ['clamp(3rem, 8vw + 1.5rem, 5.5rem)', { lineHeight: '1.05', letterSpacing: '-0.03em' }],
        'display-2xl-sm': ['clamp(2.94rem, 7.84vw + 1.47rem, 5.39rem)', { lineHeight: '1.05', letterSpacing: '-0.03em' }],
        'hero-gradient': ['clamp(3.5rem, 10vw + 2rem, 6.5rem)', { lineHeight: '1.05', letterSpacing: '-0.035em' }],
        'hero-gradient-sm': ['clamp(3.43rem, 9.8vw + 1.96rem, 6.37rem)', { lineHeight: '1.05', letterSpacing: '-0.035em' }],
        'hero-compact': ['clamp(1.75rem, 4.5vw + 0.75rem, 2.75rem)', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'display-compact': ['clamp(1.5rem, 3.5vw + 0.5rem, 2.25rem)', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'display-lg': ['clamp(2rem, 4vw + 0.5rem, 3rem)', { lineHeight: '1.15', letterSpacing: '-0.02em' }],
      },
      colors: {
        violet: { 950: '#1e1b4b' },
        fuchsia: { 950: '#2d0a33' },
        surface: {
          dark: '#0c0f1a',
          darker: '#080b12',
        },
        brand: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        accent: {
          400: '#a78bfa',
          500: '#8b5cf6',
        },
        ink: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
      },
      boxShadow: {
        'soft': '0 1px 3px 0 rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
        'card': '0 4px 6px -1px rgb(0 0 0 / 0.04), 0 10px 20px -10px rgb(0 0 0 / 0.08)',
        'elevated': '0 12px 24px -8px rgb(0 0 0 / 0.12), 0 4px 8px -4px rgb(0 0 0 / 0.06)',
        'glow': '0 0 0 1px rgb(255 255 255 / 0.06), 0 20px 40px -12px rgb(0 0 0 / 0.25)',
        'card-accent': '0 4px 14px -2px rgb(0 0 0 / 0.08), 0 12px 28px -8px rgb(99 102 241 / 0.15)',
      },
      transitionDuration: { '250': '250ms' },
      animation: {
        'shimmer': 'shimmer 2s ease-in-out infinite',
        'pulse-soft': 'pulse-soft 1.5s ease-in-out infinite',
      },
      keyframes: {
        shimmer: { '0%, 100%': { opacity: '0.4' }, '50%': { opacity: '1' } },
        'pulse-soft': { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.7' } },
      },
    },
  },
  plugins: [],
}
