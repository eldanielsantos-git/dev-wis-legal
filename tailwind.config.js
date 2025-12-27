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
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
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
      screens: {
        'max-h-680': { 'raw': '(max-height: 680px) and (min-width: 1024px)' },
        'max-h-900': { 'raw': '(max-height: 900px) and (min-width: 1024px)' },
        'xlg': '1440px',
      },
    },
  },
  plugins: [],
};
