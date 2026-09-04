import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

// PRD §9.2 tokens. Dark only. Saturated colour is reserved for risk,
// the violet disagreement marker, and the single teal accent.
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: { 0: '#0B1220', 1: '#111A2E', 2: '#182338' },
        border: '#23304A',
        text: { 1: '#E6EDF7', 2: '#9AA8C0', 3: '#66748F' },
        accent: '#2DD4BF',
        risk: { green: '#34D399', amber: '#FBBF24', red: '#F87171' },
        flag: { violet: '#A78BFA' },
        // shadcn semantic aliases mapped onto the same tokens
        background: '#0B1220',
        foreground: '#E6EDF7',
        card: { DEFAULT: '#111A2E', foreground: '#E6EDF7' },
        popover: { DEFAULT: '#182338', foreground: '#E6EDF7' },
        primary: { DEFAULT: '#2DD4BF', foreground: '#0B1220' },
        secondary: { DEFAULT: '#182338', foreground: '#E6EDF7' },
        muted: { DEFAULT: '#182338', foreground: '#9AA8C0' },
        destructive: { DEFAULT: '#F87171', foreground: '#0B1220' },
        input: '#23304A',
        ring: '#2DD4BF',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: { label: ['11px', { lineHeight: '14px', letterSpacing: '0.06em' }] },
      borderRadius: { lg: '8px', md: '6px', sm: '4px' },
      backgroundImage: {
        // --gap: diagonal hatch of --text-3 at 20% for "no data"
        gap: 'repeating-linear-gradient(135deg, rgba(102,116,143,0.2) 0 4px, transparent 4px 8px)',
      },
    },
  },
  plugins: [animate],
} satisfies Config;
