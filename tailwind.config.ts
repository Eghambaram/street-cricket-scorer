import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Primary foreground — off-white in dark, near-black in light
        white: 'rgb(var(--color-fg) / <alpha-value>)',
        pitch: {
          DEFAULT: 'rgb(var(--color-bg)         / <alpha-value>)',
          light:   'rgb(var(--color-surface)     / <alpha-value>)',
          dark:    'rgb(var(--color-surface-dp)  / <alpha-value>)',
        },
        // UI chrome — navigation, primary CTAs
        gold: {
          DEFAULT: 'rgb(var(--color-gold)        / <alpha-value>)',
          light:   'rgb(var(--color-gold-lt)     / <alpha-value>)',
          dark:    'rgb(var(--color-gold-dk)     / <alpha-value>)',
        },
        // Cricket semantic: positive scoring (1-3 runs, run rate good)
        runs: {
          DEFAULT: 'rgb(var(--color-runs)        / <alpha-value>)',
          light:   'rgb(var(--color-runs-lt)     / <alpha-value>)',
          dark:    'rgb(var(--color-runs-dk)     / <alpha-value>)',
        },
        // Cricket semantic: bowling event / alert (W chip, RRR pressure)
        amber: {
          DEFAULT: 'rgb(var(--color-amber)       / <alpha-value>)',
          light:   'rgb(var(--color-amber-lt)    / <alpha-value>)',
          dark:    'rgb(var(--color-amber-dk)    / <alpha-value>)',
        },
        // SIX ball chip — coral red per spec
        six: {
          DEFAULT: 'rgb(var(--color-six)         / <alpha-value>)',
          light:   'rgb(var(--color-six-lt)      / <alpha-value>)',
        },
        // Danger: WICKET button, flash, validation errors
        wicket: {
          DEFAULT: 'rgb(var(--color-wicket)      / <alpha-value>)',
          light:   'rgb(var(--color-wicket-lt)   / <alpha-value>)',
          dark:    'rgb(var(--color-wicket-dk)   / <alpha-value>)',
        },
        muted: 'rgb(var(--color-muted) / <alpha-value>)',
        grass: {
          DEFAULT: 'rgb(var(--color-grass)    / <alpha-value>)',
          light:   'rgb(var(--color-grass-lt) / <alpha-value>)',
        },
        // FOUR boundary — cyan
        four:      'rgb(var(--color-four)    / <alpha-value>)',
        // Safe / teal — "Target reached", neutral positive
        safe:      'rgb(var(--color-safe)    / <alpha-value>)',
        // Bowling errors — orange family (Wide lighter, NoBall deeper)
        wide:      'rgb(var(--color-wide)    / <alpha-value>)',
        noball:    'rgb(var(--color-noball)  / <alpha-value>)',
        // Ball button tinted backgrounds
        'btn-four': 'rgb(var(--color-btn-four) / <alpha-value>)',
        'btn-six':  'rgb(var(--color-btn-six)  / <alpha-value>)',
        // Role chip + avatar palette — flips between 600 (dark) and 700 (light)
        'chip-bat': 'rgb(var(--chip-bat) / <alpha-value>)',
        'chip-bow': 'rgb(var(--chip-bow) / <alpha-value>)',
        'chip-ar':  'rgb(var(--chip-ar)  / <alpha-value>)',
        'chip-wk':  'rgb(var(--chip-wk)  / <alpha-value>)',
        'chip-ex1': 'rgb(var(--chip-ex1) / <alpha-value>)',
        'chip-ex2': 'rgb(var(--chip-ex2) / <alpha-value>)',
      },
      fontFamily: {
        sans:    ['Nunito', 'system-ui', 'sans-serif'],
        mono:    ['"Space Mono"', 'Consolas', 'monospace'],
        display: ['"Bebas Neue"', 'system-ui', 'sans-serif'],
      },
      screens: { xs: '375px' },
      boxShadow: {
        card:      '0 1px 4px 0 rgb(0 0 0 / 0.4), 0 2px 16px 0 rgb(0 0 0 / 0.25)',
        'card-lg': '0 4px 30px 0 rgb(0 0 0 / 0.5)',
        glow:      '0 0 24px 0 rgb(var(--color-gold) / 0.3)',
        'glow-runs': '0 0 20px 0 rgb(var(--color-runs) / 0.3)',
        'glow-six':  '0 0 22px 0 rgb(var(--color-six)  / 0.4)',
      },
      animation: {
        // SIX — gold burst: bright peak then fade, 900ms for drama
        'flash-six':     'flashSix 0.9s ease-out',
        // FOUR — cyan sweep: quick bright pulse, 700ms
        'flash-four':    'flashFour 0.7s ease-out',
        // WICKET — red shudder: sharp hit + shake, 650ms
        'flash-wicket':  'flashWicket 0.65s ease-out',
        // Legacy aliases kept for any remaining usages
        'flash-gold':    'flashSix 0.9s ease-out',
        'flash-red':     'flashWicket 0.65s ease-out',
        'flash-runs':    'flashFour 0.7s ease-out',
        'slide-up':      'slideUp 0.3s ease-out',
        'fade-in':       'fadeIn 0.2s ease-out',
        'pulse-wicket':  'pulseWicket 2s ease-in-out infinite',
        shimmer:         'shimmer 3s linear infinite',
        'coin-spin':     'coinSpin 1.0s ease-in-out',
        'score-pulse':   'scorePulse 0.15s ease-out',
        // Flash text: pop up then fade
        'flash-text-in': 'flashTextIn 0.25s cubic-bezier(0.34,1.56,0.64,1)',
        // Full-screen overlay: neutral dark scrim + event text
        'overlay-scrim':  'overlayScrim 1.1s ease-out forwards',
        // Centered event text — spring in, hold
        'overlay-text':   'overlayText 0.3s cubic-bezier(0.34,1.56,0.64,1)',
        // Summary page staggered entrance animations
        'fade-up':        'fadeUp 0.55s cubic-bezier(0.22,1,0.36,1) both',
        'pop-in':         'popIn 0.5s cubic-bezier(0.34,1.56,0.64,1) both',
        'trophy-drop':    'trophyDrop 0.7s cubic-bezier(0.34,1.56,0.64,1) both',
        'pulse-gold':     'pulseGold 2.4s ease-in-out infinite',
        'slide-down':     'slideDown 0.28s cubic-bezier(0.22,1,0.36,1)',
      },
      keyframes: {
        // SIX: coral red burst — spec accent-six
        flashSix: {
          '0%':   { backgroundColor: 'rgb(var(--color-six) / 0.45)', transform: 'scale(1.005)' },
          '35%':  { backgroundColor: 'rgb(var(--color-six) / 0.30)', transform: 'scale(1)' },
          '100%': { backgroundColor: 'transparent',                   transform: 'scale(1)' },
        },
        // FOUR: cyan sweep — sharp in, quick out
        flashFour: {
          '0%':   { backgroundColor: 'rgb(var(--color-four) / 0.38)', transform: 'scale(1.003)' },
          '40%':  { backgroundColor: 'rgb(var(--color-four) / 0.18)' },
          '100%': { backgroundColor: 'transparent',                    transform: 'scale(1)' },
        },
        // WICKET: red shudder — hit + micro-shake conveys shock
        flashWicket: {
          '0%':   { backgroundColor: 'rgb(var(--color-wicket) / 0.40)', transform: 'translateX(0)' },
          '15%':  { backgroundColor: 'rgb(var(--color-wicket) / 0.35)', transform: 'translateX(-3px)' },
          '30%':  { backgroundColor: 'rgb(var(--color-wicket) / 0.30)', transform: 'translateX(3px)' },
          '45%':  { backgroundColor: 'rgb(var(--color-wicket) / 0.22)', transform: 'translateX(-2px)' },
          '60%':  { backgroundColor: 'rgb(var(--color-wicket) / 0.14)', transform: 'translateX(1px)' },
          '100%': { backgroundColor: 'transparent',                      transform: 'translateX(0)' },
        },
        // Flash text: spring pop
        flashTextIn: {
          '0%':   { opacity: '0', transform: 'scale(0.6) translateY(-4px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        slideUp: {
          '0%':   { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)',    opacity: '1' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        pulseWicket: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgb(var(--color-wicket) / 0)' },
          '50%':      { boxShadow: '0 0 0 7px rgb(var(--color-wicket) / 0.35)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition:  '200% center' },
        },
        coinSpin: {
          '0%':   { transform: 'rotateY(0deg) scale(1)' },
          '25%':  { transform: 'rotateY(180deg) scale(1.15)' },
          '50%':  { transform: 'rotateY(360deg) scale(1)' },
          '75%':  { transform: 'rotateY(540deg) scale(1.1)' },
          '100%': { transform: 'rotateY(720deg) scale(1)' },
        },
        scorePulse: {
          '0%':   { transform: 'scale(1)' },
          '50%':  { transform: 'scale(1.08)' },
          '100%': { transform: 'scale(1)' },
        },
        // Neutral dark scrim — fades from 0.5 to 0, mode-agnostic
        overlayScrim: {
          '0%':   { opacity: '1' },
          '35%':  { opacity: '0.95' },
          '100%': { opacity: '0' },
        },
        // Overlay event text: spring in and hold
        overlayText: {
          '0%':   { opacity: '0', transform: 'scale(0.55) translateY(8px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)'      },
        },
        fadeUp: {
          '0%':   { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)'    },
        },
        popIn: {
          '0%':   { opacity: '0', transform: 'scale(0.75)' },
          '100%': { opacity: '1', transform: 'scale(1)'    },
        },
        trophyDrop: {
          '0%':   { opacity: '0', transform: 'scale(0.4) translateY(-30px) rotate(-15deg)' },
          '60%':  { transform: 'scale(1.15) translateY(4px) rotate(4deg)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0) rotate(0deg)' },
        },
        pulseGold: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgb(var(--color-gold) / 0)' },
          '50%':      { boxShadow: '0 0 0 10px rgb(var(--color-gold) / 0.18)' },
        },
        // Toast entrance — slides down from above (top-anchored toasts)
        slideDown: {
          '0%':   { transform: 'translateY(-16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',     opacity: '1' },
        },
        // Toast progress bar — shrinks from full width to nothing
        toastProgress: {
          '0%':   { width: '100%' },
          '100%': { width: '0%'   },
        },
      },
      minHeight: { screen: ['100vh', '100dvh'] },
    },
  },
  plugins: [],
};

export default config;
