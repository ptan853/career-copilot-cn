/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        app: {
          bg: '#d8f4eb',
          panel: '#ffffff',
          'panel-soft': '#f7fbfa',
          ink: '#151827',
          muted: '#6d7382',
          line: '#e6e1dc',
          'line-soft': '#f0ece7',
          blue: '#4a7dff',
          'blue-ink': '#244db7',
          cyan: '#5dcdb4',
          amber: '#c78733',
          green: '#34a47f',
          red: '#d95f67',
          violet: '#8e74ff',
        },
        sidebar: {
          bg: '#f3eee8',
          text: '#4d515d',
          muted: '#9a948e',
          hover: '#ffffff',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        serif: ['Georgia', '"Times New Roman"', 'serif'],
      },
      boxShadow: {
        'panel': '0 18px 50px rgba(78, 95, 110, 0.10)',
        'nav-active': '0 14px 28px rgba(20, 24, 39, .16)',
      },
      borderRadius: {
        'sm': '10px',
        DEFAULT: '14px',
        'lg': '20px',
        'xl': '28px',
      },
    },
  },
  plugins: [],
}
