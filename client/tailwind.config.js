/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        gs: {
          bg:           '#141922',
          surface:      '#1b2436',
          card:         '#1c2535',
          border:       '#27334a',
          accent:       '#22c55e',
          'accent-dim': '#16a34a',
          text:         '#dce8f5',
          muted:        '#7a96b2',
          danger:       '#f87171',
          warn:         '#fbbf24',
          info:         '#60a5fa',
          purple:       '#c084fc'
        }
      },
      boxShadow: {
        'card':       '0 1px 3px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.04)',
        'card-lift':  '0 12px 36px rgba(0,0,0,0.5), 0 0 0 1px rgba(34,197,94,0.16)',
        'glow-green': '0 0 20px rgba(34,197,94,0.22)',
      }
    }
  },
  plugins: []
};
