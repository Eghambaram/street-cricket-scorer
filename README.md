# 🏏 CricScore — Street Cricket Scorer

A **Progressive Web App (PWA)** for scoring street cricket matches ball by ball. Works fully offline, installs to your home screen, and covers every real-world street cricket scenario.

---

## Features

- **Ball-by-ball scoring** — 0, 1, 2, 3, 4, 6, Wicket, Wide, No-Ball, Bye, Leg Bye
- **Live scoreboard** — runs, wickets, overs, run rate, required run rate
- **Full scorecard** — batting card, bowling card, fall of wickets, over-by-over breakdown
- **Street cricket rules** — Last Man Stands, One-Tip-One-Hand, no LBW, max overs per bowler
- **Teams & squads** — manage up to 50 players per team, career stats, session-based stats reset
- **Leaderboard** — per-team batting and bowling leaderboard with tournament reset
- **Team generator** — random squad builder with PNG export
- **Share scorecard** — text scorecard (WhatsApp/SMS) + premium PNG image
- **Undo** — undo the last delivery at any time
- **Offline-first** — all data stored locally in IndexedDB (Dexie.js), no account needed
- **PWA** — installable on Android and iOS, works without internet
- **Dark & Light theme** — premium "Pitch Night" dark theme + "Day Play" light theme

---

## Tech Stack

| Layer | Library |
|---|---|
| Framework | React 18 + TypeScript |
| Build | Vite 5 |
| PWA | vite-plugin-pwa (Workbox) |
| State | Zustand |
| Local DB | Dexie.js (IndexedDB) |
| Styling | Tailwind CSS v3 |
| Routing | React Router v6 |
| Forms | React Hook Form + Zod |
| Icons | Lucide React |
| Testing | Vitest + React Testing Library |

---

## Project Structure

```
street-cricket-scorer/
├── public/
│   ├── landing.html        # Marketing landing page
│   ├── manifest.json       # PWA manifest
│   └── icons/              # App icons (192, 512px)
└── src/
    ├── pages/              # Route-level page components
    ├── components/
    │   ├── common/         # Button, Modal, Toast, Spinner…
    │   ├── layout/         # AppShell, TopBar, BottomNav
    │   ├── scoring/        # Scoreboard, BallButtons, WicketModal…
    │   ├── scorecard/      # BattingCard, BowlingCard, FOWTable…
    │   ├── setup/          # Match wizard steps
    │   └── teams/          # Squad manager, PlayerStatsModal
    ├── db/                 # Dexie schema + repo functions
    ├── store/              # Zustand stores
    ├── hooks/              # useMatch, useScoring, useTheme…
    ├── utils/              # cricket.ts, share.ts, shareImage.ts…
    └── types/              # TypeScript interfaces
```

---

## Local Development

### Prerequisites

- Node.js 18+ (LTS recommended)
- npm 9+

### Setup

```bash
# Clone the repo
git clone https://github.com/your-username/street-cricket-scorer.git
cd street-cricket-scorer

# Install dependencies
npm install

# Start dev server (http://localhost:5173)
npm run dev
```

### Other commands

```bash
# Type check
npm run typecheck

# Lint
npm run lint

# Run tests
npm run test

# Run tests with UI
npm run test:ui

# Production build (output → dist/)
npm run build

# Preview production build locally
npm run preview
```

---

## Deployment

### Deploy to Vercel (Recommended — Free)

The app is pre-configured for Vercel with `vercel.json` handling SPA routing.

#### Option A — Vercel Dashboard (no CLI needed)

1. Push your code to a GitHub repository
2. Go to [vercel.com](https://vercel.com) → **Add New Project**
3. Import your GitHub repository
4. Vercel auto-detects Vite. Confirm these settings:

   | Setting | Value |
   |---|---|
   | Framework Preset | Vite |
   | Build Command | `npm run build` |
   | Output Directory | `dist` |
   | Install Command | `npm install` |

5. Click **Deploy** — your app will be live in ~60 seconds

#### Option B — Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy (follow prompts — accept all defaults)
vercel

# Deploy to production
vercel --prod
```

#### Vercel routing

The included `vercel.json` handles:
- `/landing` → serves `landing.html`
- All other routes → falls back to `index.html` (SPA routing)

```json
{
  "rewrites": [
    { "source": "/landing", "destination": "/landing.html" },
    { "source": "/((?!landing|icons|manifest\\.json|sw\\.js|workbox.*|assets).*)", "destination": "/index.html" }
  ]
}
```

---

### Deploy to Netlify (Alternative — Free)

1. Push your code to GitHub
2. Go to [netlify.com](https://netlify.com) → **Add new site** → **Import from Git**
3. Set build settings:

   | Setting | Value |
   |---|---|
   | Build command | `npm run build` |
   | Publish directory | `dist` |

4. Add a `public/_redirects` file for SPA routing:

```
/landing  /landing.html  200
/*        /index.html    200
```

5. Click **Deploy site**

---

### Deploy to GitHub Pages (Free)

1. Install the GitHub Pages deploy plugin:

```bash
npm install --save-dev gh-pages
```

2. Add to `package.json` scripts:

```json
"predeploy": "npm run build",
"deploy": "gh-pages -d dist"
```

3. Set `base` in `vite.config.ts` to your repo name:

```ts
export default defineConfig({
  base: '/street-cricket-scorer/',
  // ...
})
```

4. Deploy:

```bash
npm run deploy
```

> Note: GitHub Pages does not support SPA fallback routing natively. Use a `404.html` redirect workaround or switch to Vercel/Netlify for full route support.

---

## PWA Installation

### Android (Chrome)
1. Open the app URL in Chrome
2. Tap **Add to Home Screen** in the browser menu (or the install banner in the app)
3. Tap **Install**

### iOS (Safari)
1. Open the app URL in Safari
2. Tap the **Share** button (box with arrow)
3. Tap **Add to Home Screen**
4. Tap **Add**

Once installed the app runs fully standalone — no browser chrome, works offline.

---

## Environment Variables

None required. The app is entirely client-side with no backend or API keys.

---

## License

MIT
