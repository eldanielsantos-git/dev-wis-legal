/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'wis': {
          'dark': '#0F0E0D',
          'card': '#C6B08C',
          'light': '#FAFAFA',
          'border': '#242424',
        },
        'theme': {
          'bg-primary': 'var(--theme-bg-primary)',
          'bg-secondary': 'var(--theme-bg-secondary)',
          'bg-tertiary': 'var(--theme-bg-tertiary)',
          'text-primary': 'var(--theme-text-primary)',
          'text-secondary': 'var(--theme-text-secondary)',
          'text-tertiary': 'var(--theme-text-tertiary)',
          'border': 'var(--theme-border)',
          'card': 'var(--theme-card)',
        },
      },
      fontFamily: {
        'title': ['"Poltawski Nowy"', 'serif'],
        'body': ['"Instrument Sans"', '"Open Sans"', '"Roboto"', 'sans-serif'],
        'garamond': ['"EB Garamond"', 'serif'],
        'poltawski': ['"Poltawski Nowy"', 'serif'],
        'instrument': ['"Instrument Sans"', 'sans-serif'],
        'roboto': ['"Roboto"', 'sans-serif'],
        'opensans': ['"Open Sans"', 'sans-serif'],
      },
      fontWeight: {
        'title': '600',
      },
    },
  },
  plugins: [],
};
