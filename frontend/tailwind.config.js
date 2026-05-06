/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0F766E',
          hover: '#0D5F58',
          light: '#CCFBF1',
        },
        accent: {
          DEFAULT: '#6366F1',
          hover: '#4F46E5',
          light: '#EEF2FF',
        },
        success: { DEFAULT: '#10B981', light: '#D1FAE5' },
        warning: { DEFAULT: '#F59E0B', light: '#FEF3C7' },
        danger:  { DEFAULT: '#EF4444', light: '#FEE2E2' },
        surface: {
          DEFAULT: '#FFFFFF',
          dark:    '#0F172A',
        },
        background: {
          DEFAULT: '#F8FAFC',
          dark:    '#020617',
        },
        text: {
          primary: '#0F172A',
          muted:   '#64748B',
          dark:    '#F1F5F9',
        },
        border: {
          DEFAULT: '#E2E8F0',
          dark:    '#1E293B',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.75rem', { lineHeight: '1rem' }],
        xs:   ['0.875rem', { lineHeight: '1.25rem' }],
        sm:   ['1rem',     { lineHeight: '1.6' }],
        md:   ['1.125rem', { lineHeight: '1.6' }],
        lg:   ['1.25rem',  { lineHeight: '1.5' }],
        xl:   ['1.5rem',   { lineHeight: '1.4' }],
        '2xl':['1.875rem', { lineHeight: '1.3' }],
        '3xl':['2.25rem',  { lineHeight: '1.2' }],
        '4xl':['3rem',     { lineHeight: '1.1' }],
      },
      spacing: {
        1: '4px', 2: '8px', 3: '12px', 4: '16px',
        6: '24px', 8: '32px', 12: '48px', 16: '64px',
      },
      borderRadius: {
        sm: '6px', DEFAULT: '10px', lg: '16px', full: '9999px',
      },
      boxShadow: {
        sm: '0 1px 3px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)',
        md: '0 4px 12px rgba(15,23,42,0.08), 0 2px 6px rgba(15,23,42,0.05)',
        lg: '0 16px 40px rgba(15,23,42,0.12), 0 4px 16px rgba(15,23,42,0.08)',
        xl: '0 24px 60px rgba(15,23,42,0.16), 0 8px 24px rgba(15,23,42,0.10)',
      },
      animation: {
        shimmer: 'shimmer 1.5s linear infinite',
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.25s ease-out',
      },
      keyframes: {
        shimmer: {
          '0%':   { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
