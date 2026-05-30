/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        display: ['Poppins', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        gs: {
          bg:           '#F3F7F1',
          surface:      '#F8FBF7',
          card:         '#FFFFFF',
          border:       '#DCE7DB',
          accent:       '#16A34A',
          'accent-dim': '#15803D',
          text:         '#0F172A',
          muted:        '#64748B',
          danger:       '#DC2626',
          warn:         '#D97706',
          info:         '#2563EB',
          purple:       '#9333EA',
          ink:          '#07170A',
          moss:         '#0F2A14',
          cream:        '#FBFCF7',
          glass:        'rgba(255,255,255,0.72)'
        }
      },
      boxShadow: {
        'card':       '0 14px 36px rgba(15, 42, 20, 0.08), 0 1px 0 rgba(255,255,255,0.86) inset',
        'card-lift':  '0 22px 55px rgba(15, 42, 20, 0.14), 0 0 0 1px rgba(22,163,74,0.14)',
        'glow-green': '0 0 28px rgba(22,163,74,0.22)',
        'neo':        '9px 9px 22px rgba(15,42,20,0.10), -9px -9px 22px rgba(255,255,255,0.92)',
        'neo-inset':  'inset 3px 3px 7px rgba(15,42,20,0.10), inset -3px -3px 8px rgba(255,255,255,0.92)',
        'glass':      '0 20px 55px rgba(15,42,20,0.12), inset 0 1px 0 rgba(255,255,255,0.78)',
      }
    }
  },
  plugins: []
};
