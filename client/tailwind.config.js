/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0a6352',   // deep saturated teal
          light: '#0d8a6e',     // richer hover teal
          dark: '#051f19',      // near-black for dark accents
          50:  '#f0faf7',
          100: '#d6f0e9',
          200: '#aedfd2',
          500: '#0a6352',
          600: '#085546',
          700: '#063d32',
        },
        // Clean slate grays for the new sidebar/layout
        slate: {
          50:  '#f8fafc',
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
        bg: '#F8FAFC',          // ultra-clean off-white
        surface: '#FFFFFF',
        border: '#E2E8F0',      // soft blue-gray border
        text: {
          primary: '#0f172a',   // deep slate for readability
          secondary: '#64748b', // mid slate for labels/muted
        },
        // Status / accent colors
        success: { DEFAULT: '#10b981', light: '#d1fae5', dark: '#065f46' },
        warning: { DEFAULT: '#f59e0b', light: '#fef3c7', dark: '#92400e' },
        danger:  { DEFAULT: '#ef4444', light: '#fee2e2', dark: '#991b1b' },
        info:    { DEFAULT: '#3b82f6', light: '#dbeafe', dark: '#1e40af' },
      },
      fontFamily: {
        sans:    ['"Inter"', '"DM Sans"', 'system-ui', 'sans-serif'],
        display: ['"Inter"', '"DM Sans"', 'system-ui', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        '2xl': '16px',
        xl:    '12px',
        lg:    '10px',
        md:    '8px',
        sm:    '6px',
      },
      boxShadow: {
        'card':       '0 1px 3px rgba(15,23,42,0.06), 0 4px 16px rgba(15,23,42,0.06)',
        'card-hover': '0 4px 20px rgba(10,99,82,0.12), 0 1px 4px rgba(15,23,42,0.08)',
        'sidebar':    '2px 0 20px rgba(15,23,42,0.06)',
        'modal':      '0 20px 60px rgba(15,23,42,0.18), 0 8px 24px rgba(15,23,42,0.10)',
        'sm':         '0 1px 2px rgba(15,23,42,0.06)',
        'btn':        '0 2px 8px rgba(10,99,82,0.25)',
      },
      keyframes: {
        fadeUp: {
          '0%':   { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideInLeft: {
          '0%':   { opacity: '0', transform: 'translateX(-12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulse_dot: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.4' },
        },
      },
      animation: {
        'fade-up':       'fadeUp 0.4s ease-out',
        'fade-in':       'fadeIn 0.3s ease-out',
        'slide-in-left': 'slideInLeft 0.35s ease-out',
        'shimmer':       'shimmer 1.5s infinite',
        'pulse-dot':     'pulse_dot 2s ease-in-out infinite',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
