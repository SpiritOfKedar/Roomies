/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: { display: ['Manrope', 'sans-serif'] },
      colors: {
        // Dashboard / Auth light theme (neutral monochrome)
        primary:           '#171717',
        'primary-h':       '#262626',
        bg:                '#FAFAFA',
        surface:           '#ffffff',
        border:            '#E5E5E5',
        'text-main':       '#171717',
        'text-muted':      '#737373',
        'text-secondary':  '#737373',
        // Auth blue accent
        'blue-accent':     '#2563eb',
        'blue-hover':      '#1d4ed8',
        // House detail dark theme
        'dark-bg':         '#0f172a',
        'dark-surface':    '#1e293b',
        'dark-border':     'rgba(255,255,255,0.1)',
        cyan:              '#22d3ee',
        'cyan-dark':       '#0891b2',
        // Status colors
        'status-pending':   '#94a3b8',
        'status-submitted': '#2563eb',
        'status-completed': '#22c55e',
        'status-rejected':  '#ef4444',
        'status-expired':   '#f97316',
        'status-disputed':  '#eab308',
      },
      boxShadow: {
        card:    '0 1px 3px 0 rgb(0 0 0 / 0.07), 0 1px 2px -1px rgb(0 0 0 / 0.07)',
        cyan:    '0 0 20px rgba(34,211,238,0.4)',
        'cyan-lg': '0 0 30px rgba(34,211,238,0.6)',
      },
    },
  },
  plugins: [],
};
