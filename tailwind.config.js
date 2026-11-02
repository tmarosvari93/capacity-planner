/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        page: '#F5F6F7',
        line: '#E4E6E9',
        ink: '#1B1D21',
        ink2: '#3C424B',
        muted: '#4F5661',
        hover: '#EEF0F2',
        input: '#CBD0D6',
        navy: { DEFAULT: '#1C3A62', dark: '#0F2440', t1: '#DCE7F5', t2: '#A9C1DE', t3: '#4F7CAC' },
        amber: { DEFAULT: '#B85C1E', text: '#6E2E00', t1: '#FFF4EC', t2: '#FFEBDB', t3: '#FDE7D6', t4: '#F9D3B4' },
        hint: { DEFAULT: '#8E97A3', 2: '#6B7380', 3: '#B7BEC7' },
      },
    },
  },
  plugins: [],
};
