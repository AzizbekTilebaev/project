/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#0f766e',
        navy: '#0a4541',
        'dark-navy': '#063532',
        'light-gray': '#c0c0c0',
        parchment: 'var(--color-parchment)',
        ink: 'var(--color-ink)',
        teal: {
          800: '#0f5c56',
          900: '#0a4541',
          950: '#063532',
        },
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #0f766e, #0e7490)',
        'qp-saas':
          'radial-gradient(ellipse 80% 50% at 10% -10%, rgba(15,118,110,0.16), transparent 55%), radial-gradient(ellipse 60% 40% at 100% 0%, rgba(245,158,11,0.12), transparent 50%)',
      },
      borderRadius: {
        'qp-lg': '1.75rem',
        'qp-md': '1.25rem',
      },
      boxShadow: {
        'qp-soft': 'var(--qp-shadow-soft)',
        'qp-card': 'var(--qp-shadow-card)',
      },
      fontFamily: {
        sans: ['Manrope', 'Segoe UI', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
