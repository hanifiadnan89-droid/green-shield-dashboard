/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        heading: ['Poppins', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        gs: {
          bg:           '#F8FAFC',
          surface:      '#FFFFFF',
          card:         '#FFFFFF',
          border:       '#E2E8F0',
          accent:       '#16A34A',
          'accent-dim': '#15803D',
          text:         '#0F172A',
          muted:        '#64748B',
          danger:       '#DC2626',
          warn:         '#D97706',
          info:         '#2563EB',
          purple:       '#9333EA'
        }
      },
      boxShadow: {
        'card':       '0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)',
        'card-lift':  '0 8px 24px rgba(0,0,0,0.10), 0 0 0 1px rgba(22,163,74,0.14)',
        'glow-green': '0 0 20px rgba(22,163,74,0.20)',
      }
    }
  },
  plugins: []
};
