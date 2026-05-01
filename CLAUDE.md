# Street Cricket Scorer — CLAUDE.md

## Project Overview

A Progressive Web App (PWA) for scoring street cricket matches. Mobile-first, works fully offline, and covers all real-world street cricket scenarios — flexible team sizes, custom overs, street-specific rules, and single-player support.

**Phase 1 (current):** Local-only data via IndexedDB. No backend, no auth.  
**Phase 2 (future):** Sync to PostgreSQL via Express API (PERN stack).

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | React 18 + TypeScript + Vite | Fast HMR, first-class TS, PWA plugin support |
| PWA | vite-plugin-pwa (Workbox) | Service worker + precaching + offline |
| State | Zustand | Lightweight, no boilerplate, devtools support |
| Local DB | Dexie.js (IndexedDB wrapper) | Typed schema, async queries, reactive queries |
| Styling | Tailwind CSS v3 | Mobile-first utility classes, no runtime CSS |
| Routing | React Router v6 | Declarative routes, nested layouts |
| Forms | React Hook Form + Zod | Schema validation, no re-renders |
| Icons | Lucide React | Tree-shakeable, consistent stroke icons |
| Testing | Vitest + React Testing Library | Fast unit tests co-located with source |
| Linting | ESLint + Prettier | Enforced consistent style |

---

## Project Structure

```
street-cricket-scorer/
├── CLAUDE.md
├── prompt.md
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── package.json
├── public/
│   ├── manifest.json             # PWA manifest
│   ├── icons/                    # 72,96,128,144,152,192,384,512 PNG icons
│   └── screenshots/              # PWA install screenshots
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── sw.ts                     # Custom service worker hooks (if any)
    ├── types/
    │   ├── match.types.ts        # Match, Innings, Team
    │   ├── player.types.ts       # Player, BatsmanScore, BowlerScore
    │   ├── delivery.types.ts     # Delivery, Extras, Wicket
    │   └── rules.types.ts        # StreetCricketRules config
    ├── db/
    │   ├── database.ts           # Dexie schema + migrations
    │   └── repos/
    │       ├── matchRepo.ts
    │       ├── inningsRepo.ts
    │       └── playerRepo.ts
    ├── store/
    │   ├── matchStore.ts         # Active match state (Zustand)
    │   ├── scoringStore.ts       # Ball-by-ball live scoring
    │   └── uiStore.ts            # Modal visibility, toasts
    ├── hooks/
    │   ├── useMatch.ts           # Match CRUD wrappers
    │   ├── useScoring.ts         # Scoring actions with undo
    │   ├── useOffline.ts         # navigator.onLine + event listeners
    │   └── useInstallPrompt.ts   # PWA install banner logic
    ├── pages/
    │   ├── HomePage.tsx          # Dashboard: recent matches + actions
    │   ├── SetupPage.tsx         # New match wizard (multi-step)
    │   ├── ScoringPage.tsx       # Live scoring screen
    │   ├── ScorecardPage.tsx     # Full scorecard (read-only)
    │   ├── SummaryPage.tsx       # Match result + share
    │   └── HistoryPage.tsx       # All completed matches
    ├── components/
    │   ├── layout/
    │   │   ├── AppShell.tsx      # Root layout: topbar + content + bottom nav
    │   │   ├── TopBar.tsx        # Match title + back + menu
    │   │   └── BottomNav.tsx     # Tab navigation
    │   ├── setup/
    │   │   ├── MatchConfigStep.tsx    # Name, overs, ball type
    │   │   ├── TeamSetupStep.tsx      # Team names + player roster
    │   │   ├── TossStep.tsx           # Toss result + choice
    │   │   └── RulesStep.tsx          # Street cricket rule toggles
    │   ├── scoring/
    │   │   ├── Scoreboard.tsx         # Runs/wickets/overs hero display
    │   │   ├── BallButtons.tsx        # 0,1,2,3,4,6,W,Wd,NB,B,LB pads
    │   │   ├── BatsmanPanel.tsx       # Striker + non-striker mini scorecards
    │   │   ├── BowlerPanel.tsx        # Current bowler stats
    │   │   ├── OverTracker.tsx        # Current over balls (dots, runs, extras)
    │   │   ├── WicketModal.tsx        # Dismissal type + fielder + next batsman
    │   │   ├── ExtrasModal.tsx        # Extras with additional runs input
    │   │   ├── NewOverModal.tsx       # Select next bowler
    │   │   ├── InningsBreakModal.tsx  # End of innings summary
    │   │   └── UndoBar.tsx            # Undo last delivery
    │   ├── scorecard/
    │   │   ├── BattingCard.tsx
    │   │   ├── BowlingCard.tsx
    │   │   ├── ExtrasRow.tsx
    │   │   ├── FOWTable.tsx           # Fall of wickets
    │   │   └── OverByOver.tsx         # Over breakdown table
    │   └── common/
    │       ├── Button.tsx             # Variants: primary/secondary/danger/ghost
    │       ├── Modal.tsx              # Bottom-sheet style on mobile
    │       ├── Badge.tsx              # Run/wicket badges
    │       ├── Spinner.tsx
    │       ├── OfflineBanner.tsx      # Yellow offline indicator
    │       └── InstallBanner.tsx      # PWA add-to-home-screen prompt
    └── utils/
        ├── cricket.ts                 # runRate, requiredRR, projectedScore, overStr
        ├── format.ts                  # formatOvers("2.4"), formatScore
        └── share.ts                   # Generate ASCII/text scorecard for sharing
```

---

## Key Architecture Decisions

### Offline-First with IndexedDB
- All match data persisted in Dexie.js immediately after every delivery.
- No data is stored in component state only — state is always a view of the DB.
- Zustand store hydrates from Dexie on app load and on page focus.
- Undo is implemented by deleting the last `Delivery` row and recomputing state.

### Scoring State Machine
Active innings follows a strict state machine:

```
SETUP → TOSS → INNINGS_1 → INNINGS_BREAK → INNINGS_2 → RESULT
```

Within an innings:
```
BATTING → [after each legal delivery] → check_wickets → check_overs
       → if wicket: SELECT_BATSMAN
       → if over_complete: SELECT_BOWLER
       → if all_out or overs_complete: INNINGS_OVER
```

### No Redux / No Context for Scoring
Zustand provides a flat, simple store without prop-drilling. Context is used only for theme/locale if needed.

### Mobile-First Touch Design
- All interactive elements minimum 48×48px touch target.
- Ball input buttons arranged in a numpad-style grid for one-thumb use.
- Modals open as bottom sheets (slide up from bottom) not center dialogs.
- Scoring screen is portrait-locked. Scorecard supports both orientations.

### PWA Strategy
- **Precache**: All static assets (JS, CSS, fonts, icons).
- **Runtime cache**: Images with Cache-First, API calls with NetworkFirst (Phase 2).
- **Background sync**: Queue scoring actions when offline, replay when online (Phase 2).
- Service worker update flow: banner asks user to reload when new version available.

---

## Data Models (TypeScript)

```ts
// match.types.ts
interface Match {
  id: string;                    // uuid
  name: string;
  createdAt: number;             // Date.now()
  status: 'setup' | 'toss' | 'innings_1' | 'innings_break' | 'innings_2' | 'completed';
  config: MatchConfig;
  rules: StreetCricketRules;
  toss?: Toss;
  teams: [Team, Team];
  inningsIds: string[];
  result?: MatchResult;
}

interface MatchConfig {
  overs: number;                 // 2-50, default 5 for street
  ballsPerOver: number;          // always 6
  playersPerSide: number;        // 2-11, default 6
}

interface StreetCricketRules {
  lastManStands: boolean;        // last batsman bats alone (no partner needed)
  oneTipOneHand: boolean;        // catch off one bounce = out
  noLBW: boolean;                // LBW not applicable (common street rule)
  noByes: boolean;               // byes not counted
  retiredHurtAllowed: boolean;   // batsman can retire hurt and return
  maxOversPerBowler: number;     // 0 = no restriction
  powerPlayOvers: number;        // 0 = no powerplay
}

interface Toss {
  winnerTeamId: string;
  choice: 'bat' | 'bowl';
}

interface Team {
  id: string;
  name: string;
  players: Player[];
}

// player.types.ts
interface Player {
  id: string;
  name: string;
  teamId: string;
}

// delivery.types.ts
interface Delivery {
  id: string;
  inningsId: string;
  overIndex: number;             // 0-based
  ballIndex: number;             // 0-based legal deliveries in over
  deliverySequence: number;      // absolute sequence including extras
  batsmanId: string;
  bowlerId: string;
  runs: number;                  // runs credited to batsman
  extras: DeliveryExtras;
  totalRuns: number;             // runs + extras total
  wicket?: Wicket;
  timestamp: number;
}

interface DeliveryExtras {
  wide: number;                  // 0 or 1+runs
  noBall: number;                // 0 or 1+runs
  bye: number;                   // runs as byes
  legBye: number;                // runs as leg byes
  penalty: number;               // penalty runs (rare)
}

interface Wicket {
  type: 'bowled' | 'caught' | 'run_out' | 'stumped' | 'hit_wicket' | 'lbw' | 'handled_ball' | 'obstructing_field' | 'one_tip_one_hand';
  fielderId?: string;            // catcher, stumper, run-out fielder
  runOutBatsmanId?: string;      // which batsman for run outs
}

interface Innings {
  id: string;
  matchId: string;
  inningsNumber: 1 | 2;
  battingTeamId: string;
  bowlingTeamId: string;
  status: 'active' | 'completed';
  completedReason?: 'all_out' | 'overs_complete' | 'target_achieved' | 'declared';
  currentBatsmanIds: [string, string | null];  // [striker, non-striker]
  currentBowlerId: string | null;
  strikerIndex: 0 | 1;
}
```

---

## Commands

```bash
# Install dependencies
npm install

# Start dev server (with PWA in dev mode)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run tests
npm run test

# Run tests with UI
npm run test:ui

# Lint
npm run lint

# Type check
npm run typecheck
```

---

## Coding Conventions

- **File names**: PascalCase for components (`ScoringPage.tsx`), camelCase for utils/hooks (`useScoring.ts`).
- **Types**: All types in `src/types/`. No inline type definitions in component files.
- **Imports**: Absolute imports via `@/` alias pointing to `src/`.
- **Components**: One component per file. No default exports from `index.ts` barrels — explicit imports only.
- **State mutations**: Only via Zustand actions. Never mutate store state directly.
- **DB writes**: Always through repo functions in `src/db/repos/`. Never call Dexie directly from components.
- **Tailwind**: No custom CSS files. All styling via Tailwind classes. Use `cn()` (clsx + twMerge) for conditional classes.
- **Error handling**: Use `try/catch` in repo functions and surface errors via `uiStore` toast, not `console.error`.
- **No any**: TypeScript strict mode on. No `any`, no `@ts-ignore` without explanation comment.

---

## Scoring Logic Rules

### Legal vs Extra Deliveries
- **Wide** and **No Ball** do NOT count as a legal delivery (ball count does not advance for the over).
- **Bye** and **Leg Bye** count as legal deliveries (ball count advances).
- Runs from **wide** are not credited to batsman.
- Runs from **no-ball** extras go to extras; any runs batsman scores off a no-ball go to batsman.
- A batsman **cannot** be out caught/bowled/LBW off a wide.
- A batsman **can** be run out off a wide or no-ball.

### Strike Rotation
- Odd runs (1, 3) → rotate strike.
- Even runs (0, 2, 4, 6) → strike stays.
- End of over → rotate strike (non-striker becomes striker).
- Wide/No-ball with 0 batsman runs → strike stays.
- Last ball of over with wicket → new batsman comes in as non-striker, then rotates at start of next over.

### Completion Conditions
- All out: `wickets === playersPerSide - 1` (unless lastManStands enabled).
- With lastManStands: `wickets === playersPerSide` (all players dismissed).
- Target achieved: `innings_2_runs > innings_1_runs` (match won by chasing team).
- Tie: `innings_2_runs === innings_1_runs` at all out or overs complete.

---

## UI Color Theme

```
Background:   #0f4c1e  (deep cricket green)
Surface:      #1a6b2e  (card/panel green)
Accent:       #f0c040  (golden yellow — boundaries, highlights)
Danger:       #e53935  (wickets, red cards)
Text Primary: #ffffff
Text Muted:   #a5d6a7
```

Use Tailwind custom colors in `tailwind.config.ts` with this palette.

---

## PWA Manifest Key Config

```json
{
  "name": "Street Cricket Scorer",
  "short_name": "CricScore",
  "theme_color": "#0f4c1e",
  "background_color": "#0f4c1e",
  "display": "standalone",
  "orientation": "portrait-primary",
  "categories": ["sports", "utilities"]
}
```

---

## Future Phase 2 — Backend

When Phase 2 begins:
- Add `backend/` folder with Express + TypeScript.
- PostgreSQL with Prisma ORM.
- Match sync: client-wins strategy (local data is authoritative; push to server on reconnect).
- Auth: JWT-based, simple email/password only.
- Endpoints prefix: `/api/v1/`.
- Do NOT change the frontend DB schema — Dexie stays as the local source of truth.
