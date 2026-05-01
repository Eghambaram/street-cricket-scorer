# Street Cricket Scorer — Product Requirements & Prompt Document

> **Use this file as the authoritative specification when building features.**  
> Reference screen names, component names, and rule names exactly as written here.

---

## 1. Product Vision

**Who:** Casual cricket players in streets, parks, gullies, and open spaces.  
**What:** A dead-simple scoring app that works on any phone, with or without internet.  
**Why:** Existing scorers are designed for official cricket — overkill for 4v4 in a lane with a taped ball and one stump. Street cricket has its own rules, informal setups, and needs something that matches that culture.

**Core Promise:**
- Start scoring in under 60 seconds.
- Never lose a match due to phone losing internet.
- Works on a 5-year-old Android Chrome with no install required.
- Feels like tapping a physical scorebook, not filling a government form.

---

## 2. User Types

| User | Description |
|---|---|
| **Scorer** | Primary user. Sits/stands aside and taps scores ball by ball. Can be one of the players. |
| **Captain / Organiser** | Sets up the match, configures rules, enters player names. Often same as Scorer. |
| **Single Player Mode** | One person organising an informal match alone — no team setup needed, just tap scores. |
| **Viewer** | Someone checking the scorecard after the fact — read-only access via History. |

---

## 3. Feature List

### 3.1 Match Setup (New Match Wizard)

**Step 1 — Match Config**
- Match name (optional, auto-generates "Street Match – Apr 10" if blank)
- Number of overs: picker 1–50, default **5**
- Players per side: picker 2–11, default **6**
- Ball type: Tennis ball / Tape ball / Rubber ball / Leather (cosmetic label, no logic change)
- Date: auto-filled to today, editable

**Step 2 — Teams & Players**
- Team A name (default: "Team A")
- Team B name (default: "Team B")
- Add players: simple list with "Add Player" button
  - Player name text input
  - Quick-add: "Player 1, Player 2 ..." auto-numbered if user skips names
- Minimum: 2 players per team (unless Single Player Mode)
- **Single Player Mode toggle**: Skip team/player setup entirely. Score as anonymous teams. Good for keeping a quick tally.

**Step 3 — Toss**
- Which team won the toss: Team A / Team B selector
- What did they choose: Bat / Bowl selector
- Visual: coin flip animation (optional — show only if device supports it)

**Step 4 — Street Cricket Rules**
All toggles default OFF unless noted:

| Rule | Default | Description |
|---|---|---|
| Last Man Stands | ON | Last batsman can bat alone when all partners are out |
| One Tip One Hand | OFF | Catch off one bounce = dismissal (toggle for one-hand variation) |
| No LBW | ON | LBW dismissals not applicable |
| No Byes | OFF | Byes not counted as extras |
| Max Overs Per Bowler | OFF | Set 0–N (0 = unlimited) |
| Power Play Overs | OFF | First N overs = powerplay (no field restrictions — just marker) |
| Retired Hurt Allowed | ON | Batsman can retire and return |

**Step 5 — Review & Start**
- Summary of all config
- "Start Match" CTA button

---

### 3.2 Live Scoring Screen

This is the most critical screen. Must be usable with one thumb.

#### 3.2.1 Scoreboard (Top Area)
```
┌──────────────────────────────────────────┐
│  Team A vs Team B         [⋮ Menu]       │
│                                          │
│        142 / 4          Ov: 8.3 / 10    │
│                                          │
│   RR: 6.8    Need: 23 off 9 balls        │
└──────────────────────────────────────────┘
```
- Team name (batting team)
- Runs / Wickets — largest text on screen
- Overs bowled of total (e.g., "8.3 / 10")
- Current run rate
- 2nd innings only: required runs off remaining balls, required run rate
- 1st innings only: projected score (simple linear projection)

#### 3.2.2 Batsmen Panel (Middle Left)
```
┌─────────────────────┐
│ ● Rahul   42 (31)   │
│   Priya   18 (14)   │
└─────────────────────┘
```
- Bullet (●) marks striker
- Name + Runs + (Balls faced)
- Tap batsman name to see their full dismissal/stats — does NOT change striker (accidental taps safe)
- Batsman who hasn't yet batted shown greyed out in a "Yet to bat" section

#### 3.2.3 Bowler Panel (Middle Right)
```
┌─────────────────────┐
│ Ajay                │
│ 2.3-0-18-1          │
│ Econ: 7.2           │
└─────────────────────┘
```
- Current bowler name
- Standard bowling figures (Overs-Maidens-Runs-Wickets)
- Economy rate

#### 3.2.4 This Over Tracker (Below panels)
```
  1  ·  4  Wd  ·  2
```
- Shows each delivery outcome in the current over
- Symbols: `·` = dot, number = runs, `W` = wicket, `Wd` = wide, `NB` = no-ball, `B` = bye, `LB` = leg bye
- Coloured badges: red for wickets, yellow for boundaries (4/6), blue for extras

#### 3.2.5 Ball Input Pad (Main Area — Bottom Half)
Primary row — runs:
```
[ 0 ] [ 1 ] [ 2 ] [ 3 ] [ 4 ] [ 6 ]
```
Secondary row — events:
```
[ W ]  [ Wd ]  [ NB ]  [ B ]  [ LB ]
```
- All buttons minimum 56px height, comfortable tap targets
- `W` = Wicket → opens WicketModal
- `Wd` = Wide → adds 1 wide, prompts if additional runs off the wide
- `NB` = No Ball → adds 1 no-ball, prompts for runs scored (batsman runs + no-ball extra)
- `B` = Bye → runs as byes (legal delivery)
- `LB` = Leg Bye → runs as leg byes (legal delivery)
- Long-press `4` to enter 5 (rare but possible)
- Long-press `6` → penalty runs input

#### 3.2.6 Undo Bar
```
  [↩ Undo Last Ball]
```
- Single undo of last delivery
- Shows what it will undo: "Undo: W (Bowled)" or "Undo: 4 (boundary)"
- Disappears after new delivery entered
- Confirmation dialog only for wicket undos

---

### 3.3 Wicket Modal

Triggered when `[W]` is tapped.

```
┌───────── Wicket ──────────────────────────┐
│  Dismissal Type:                          │
│  [Bowled] [Caught] [Run Out]              │
│  [Stumped] [Hit Wicket] [LBW*]            │
│  [One Tip One Hand**]                     │
│                                           │
│  Fielder (if caught/stumped/run out):     │
│  [Dropdown: player list]                  │
│                                           │
│  Which batsman out (if run out):          │
│  [Striker] [Non-Striker]                  │
│                                           │
│  Next Batsman In:                         │
│  [Dropdown: remaining players]            │
│                                           │
│       [Confirm Wicket]                    │
└───────────────────────────────────────────┘
```
- `*` LBW hidden if noLBW rule is ON
- `**` One Tip One Hand shown only if rule is ON
- Caught: fielder required
- Stumped: fielder required (must be wicket-keeper — first player by default)
- Run Out: fielder optional, which batsman is required
- Bowled/Hit Wicket: no fielder needed
- If last wicket (all out): "Next Batsman" field hidden, show "Innings Over"

---

### 3.4 End of Over Flow

When the 6th legal ball of an over is bowled:
1. Show **Over Summary modal** briefly (auto-dismiss after 5s or tap to dismiss):
   ```
   Over 8 complete — 14 runs, 1 wicket
   Bowler: Ajay — 2-0-18-1
   ```
2. Open **Select Next Bowler modal**:
   - List all players from bowling team
   - Highlight last bowler (greyed out — cannot bowl consecutive overs in most formats, but this is configurable)
   - If maxOversPerBowler is set: show each bowler's overs used vs max
   - Confirm selection → scoring continues

---

### 3.5 Innings Break

When first innings ends (all out or overs complete):
1. Show **Innings Break screen**:
   - Final score: "Team A: 89/6 in 10 overs"
   - "Team B need 90 to win off 10 overs (9.0 per over)"
   - Select opening batsmen for Team B
   - Select opening bowler for Team B
   - "Start 2nd Innings" button

---

### 3.6 Match Complete / Summary Screen

When match ends:
```
┌────────────────────────────────────────────┐
│           MATCH RESULT                     │
│                                            │
│   Team A won by 23 runs                    │
│   (or Team B won by 4 wickets)             │
│   (or Match Tied)                          │
│                                            │
│   Team A: 112/4 in 10 overs                │
│   Team B: 89/8 in 10 overs                 │
│                                            │
│   Man of the Match:                        │
│   [ Select player ▼ ]                      │
│                                            │
│  [View Full Scorecard]  [Share]  [Home]    │
└────────────────────────────────────────────┘
```

**Share:** Generates a text scorecard (WhatsApp-friendly format):
```
🏏 Team A vs Team B
Date: Apr 10, 2026

1st Innings: Team A — 112/4 (10 ov)
Rahul: 42 (31) | Priya: 28 (22)
Ajay: 2-0-18-1 | Meera: 3-0-24-2

2nd Innings: Team B — 89/8 (10 ov)
Ravi: 35 (27) | ...

Result: Team A won by 23 runs
Generated by Street Cricket Scorer
```
- Uses Web Share API (native share sheet on mobile)
- Fallback: copy to clipboard button

---

### 3.7 Full Scorecard Screen

Accessible during and after match. Tab view: **Batting | Bowling | Overs**.

**Batting Card:**
```
Batsman          R    B   4s   6s   SR    How Out
Rahul            42   31   3    1  135.4  Caught Priya b Ajay
Priya            28   22   2    0  127.2  Bowled b Meera
...
Extras (Wd: 4, NB: 2, B: 1, LB: 0) = 7
Total: 112/4 in 10.0 overs (RR: 11.2)
```

**Bowling Card:**
```
Bowler        O    M    R    W    Econ   WD   NB
Ajay          3    0    18   1    6.0    1    0
Meera         4    1    24   2    6.0    0    1
Ravi          3    0    22   1    7.3    2    0
```

**Fall of Wickets:**
```
1-34 (Rahul, 4.2)  2-58 (Priya, 6.3)  3-89 (...)
```

**Over by Over:**
```
Over   Runs   Extras   Wickets   Bowler
1      8      1 Wd     -         Ajay
2      4      -        1 W       Meera
...
```

---

### 3.8 Match History Screen

- List of all completed matches, newest first
- Each card: Teams, result, date, overs format
- Filter: by date range (simple last 7 / 30 / all)
- Search: by team name or player name
- Tap → opens match summary + scorecard
- Long press → delete match (confirmation dialog)
- Export all matches as JSON (for backup)

---

### 3.9 Home Screen

```
┌──────────────────────────────────────────┐
│  🏏 Street Cricket Scorer                │
│                                          │
│  [+ New Match]                           │
│                                          │
│  ── Recent Matches ──                    │
│                                          │
│  Team A vs Team B · Apr 10               │
│  Won by 23 runs · 10 ov                  │
│                                          │
│  Team C vs Team D · Apr 8                │
│  Tied · 6 ov                             │
│                                          │
│  [View All History →]                    │
└──────────────────────────────────────────┘
```

- Show last 3 matches
- Resume match: if a match is in-progress (status ≠ completed), show a "Resume" card at the top
- Only one active match at a time (enforce this)

---

## 4. Single Player / Quick Match Mode

When "Single Player Mode" is toggled ON in setup:
- Skip team name and player name entry
- Teams auto-named "Batting Side" and "Bowling Side" — user can rename
- No player assignment — wickets tracked as number only, no batsman names
- Bowler panel hidden — just track bowler count per over
- All scoring works identically
- Useful for: keeping score alone, practice sessions, quick 3-over games

---

## 5. Offline Behaviour

- App works 100% offline after first load.
- All data stored in IndexedDB via Dexie.js.
- PWA service worker precaches all app shell assets.
- Yellow banner shows when offline: "You're offline — all scores are saved locally."
- Green banner briefly shows when back online (auto-dismiss after 3s).
- No data is lost when offline. No "sync" required in Phase 1.

---

## 6. PWA Install Experience

- Android Chrome: shows "Add to Home Screen" bottom banner.
- iOS Safari: shows custom "Install" tooltip explaining how to use "Share → Add to Home Screen".
- After install: opens in standalone mode (no browser chrome), portrait locked.
- Splash screen: cricket green with app logo.

---

## 7. Navigation Structure

```
App
├── / (Home)
├── /new-match (Setup Wizard — 5 steps)
├── /match/:id/scoring (Live Scoring)
├── /match/:id/scorecard (Scorecard)
├── /match/:id/summary (Match Result)
└── /history (All Matches)
```

- Bottom navigation: Home | New Match | History (3 tabs max)
- During live scoring: bottom nav hidden — full screen scoring mode
- Back button from scoring: confirmation "Pause match? All data is saved."

---

## 8. UI/UX Principles

1. **Cricket green palette** — dark green backgrounds, gold accents for boundaries, red for wickets.
2. **Thumb zone first** — all frequent actions in bottom 60% of screen.
3. **No hidden gestures** — every action has a visible button.
4. **Confirmations only when destructive** — don't confirm every delivery, only confirm wicket undo and match delete.
5. **Legible in sunlight** — high contrast. Use `font-bold` for all score numbers. Avoid grey-on-grey.
6. **Fast** — Scoring a ball must take 1 tap (normal runs) or 2 taps (extras/wicket requiring modal). Never 3+ taps for a routine delivery.
7. **No login wall** — App opens directly to home screen. No account, no loading screen.

---

## 9. Accessibility

- All buttons have `aria-label` attributes.
- Modal traps focus correctly.
- Tap targets minimum 48×48px (WCAG 2.5.5 enhanced).
- Do not rely solely on colour to convey information (e.g., wickets also show "W" text, not just red colour).
- Font size minimum 14px for all UI text; score numbers minimum 32px.

---

## 10. Error States & Edge Cases

| Scenario | Behaviour |
|---|---|
| Only 1 player left (no last-man-stands) | Block scoring; show "Innings Over — All Out" |
| Bowler bowled max overs, no others available | Allow anyway with a warning toast |
| User taps W but no next batsman | Innings over automatically |
| Undo after innings break | Re-open innings, remove break |
| Match target tied on last ball | Show "Tie" result |
| App closed mid-match | Resume card on home screen; state restored from Dexie |
| Player name left blank | Auto-name: "Player 1", "Player 2", etc. |
| 0 overs configured | Minimum 1 over enforced by setup validation |

---

## 11. Animations & Feedback

- **Boundary (4 or 6):** Flash gold background on scoreboard for 800ms. "FOUR!" or "SIX!" text overlay.
- **Wicket:** Red flash + "OUT!" overlay. Subtle vibration if device supports it (`navigator.vibrate(200)`).
- **Dot ball:** Subtle grey pulse on ball pad.
- **Over complete:** Brief over-summary modal slides up.
- **Match win:** Confetti animation (canvas-confetti library or CSS only).
- Keep animations under 800ms — do not block input.

---

## 12. Component Build Order (Recommended)

Build in this order to have a working vertical slice early:

1. `database.ts` — Dexie schema
2. `types/` — All TypeScript types
3. `matchRepo.ts`, `inningsRepo.ts` — DB CRUD
4. `scoringStore.ts` — Zustand store (core state machine)
5. `useScoring.ts` — Hook wrapping store + repo
6. `Scoreboard.tsx` — Static display first
7. `BallButtons.tsx` — Core tap interface
8. `WicketModal.tsx` + `NewOverModal.tsx`
9. `ScoringPage.tsx` — Assemble all scoring components
10. `SetupPage.tsx` — Match creation wizard
11. `ScorecardPage.tsx` — Read-only scorecard
12. `SummaryPage.tsx` + share logic
13. `HomePage.tsx` + `HistoryPage.tsx`
14. PWA config (manifest + service worker)
15. Install prompt + offline banner

---

## 13. Testing Checklist

Before marking any feature complete, verify:

- [ ] Ball scored correctly (runs credited to correct batsman)
- [ ] Extras do not credit runs to batsman (wide/no-ball)
- [ ] Legal delivery count correct (wide/no-ball don't advance over count)
- [ ] Strike rotates correctly on odd runs + end of over
- [ ] Wicket flow: correct player marked out, next player comes in
- [ ] Over completion: bowler stats update, next bowler modal shows
- [ ] All-out detection: correct for lastManStands ON and OFF
- [ ] Target calculation: correct for 2nd innings
- [ ] Undo: removes last delivery, restores all state
- [ ] App reload: state restored from IndexedDB exactly
- [ ] Offline: scores save without network
- [ ] Share: text scorecard formatted correctly

---

## 14. Not In Scope (Phase 1)

- User accounts / cloud sync
- Live scorecard sharing via URL
- Multiple concurrent matches per user
- Tournament / league management
- DRS / review system
- Push notifications
- Ads or monetisation
- Backend API

These are Phase 2+ features. Do not add infrastructure for them in Phase 1.

---

## 15. Master Team Roster (TeamsPage — `/teams`)

Street cricket groups often have 20–30 regular players split across rotating teams. The master roster lets you save those squads once and pick a subset per match.

### Data Model
```ts
interface SavedTeam {
  id: string; name: string;
  players: SavedPlayer[];
  createdAt: number; updatedAt: number;
}
interface SavedPlayer {
  id: string; name: string;
  role?: 'batsman' | 'bowler' | 'allrounder' | 'wicketkeeper';
}
```
Stored in `savedTeams` Dexie table (`id, name, createdAt`).

### TeamsPage Features
- Create / rename / delete teams
- Add / edit / remove players per team (2–30 players, roles optional)
- Player role badges: BAT / BOWL / AR / WK (gold, optional)
- Tap any player name → **PlayerStatsModal** showing career stats
- Toast feedback on all mutations: `"Player X added"`, `"Team name updated"`, `"Team deleted"`
- Accessible via bottom nav tab (Users icon)

### Team Setup Integration (Setup Wizard Step 2)
When saved teams exist, Step 2 shows mode-toggle tabs:
- **Saved Team mode** (default when teams exist): pick a team → checkbox squad selection with Select All; min 2 players enforced
- **Manual mode**: type team name + add players inline
- Repeat for Team B

### Career Stats (`src/utils/playerStats.ts`)
Computed from all deliveries across all IndexedDB matches per player:

**Batting:** Innings, Runs, HS, Avg, SR, 50s, 100s, 4s, 6s, Not-outs
**Bowling:** Innings, Wkts, Runs conceded, Avg, Economy, Best bowling (W/R), Maidens, Overs

Displayed in `PlayerStatsModal` as two sections with 4-column stat grids. Shows "No batting data" / "No bowling data" when empty.

---

## 16. Live Match Controls

### Manual Strike Rotation
- "Rotate Strike" button (ArrowLeftRight icon) between batsman rows in BatsmanPanel
- Only shown when both batsmen are present at crease
- Immediately saves updated innings to DB

### Change Batsman Mid-Innings
- Tap any batsman name in BatsmanPanel → ChangeBatsmanModal for that slot
- Shows two sections: **Yet to Bat** (fresh players) and **Recall Retired Hurt** (HeartPulse gold styling)
- Section headers only shown when both sections have entries
- Dismissed players excluded; retired-hurt players excluded from "Yet to Bat"

### Change Bowler Mid-Over
- Tap bowler name in BowlerPanel → ChangeBowlerModal
- Lists eligible bowlers with O-M-R-W stats and over-cap progress
- Ineligible bowlers shown greyed with reason (last bowler / cap reached)
- Informational note: current over continues for the newly selected bowler

### Retired Hurt
- Enabled via `retiredHurtAllowed` rule toggle
- WicketModal shows **Dismissed / Retired Hurt** tab toggle (hidden on last man)
- Retire Hurt mode: choose which batsman retires + optional replacement batsman select ("No replacement now" default)
- Retired batsmen stored in `innings.retiredHurtIds[]`
- Recalled from ChangeBatsmanModal "Recall Retired Hurt" section when a wicket falls
- `retiredHurtIds` survives undo (carried forward in `recomputeInningsLiveState`)

---

## 17. Close Innings & Close Match (Overflow Menu)

**⋮ overflow menu** in ScoringPage top bar contains:
- **Close Innings** → CloseInningsModal
- **End Match** → CloseMatchModal
- **Leave Scoring** → pause confirmation modal

### CloseInningsModal
Two options:
- **Declare** (gold, Flag icon): finalises innings with `completedReason: 'declared'`; if Innings 1 → InningsBreakModal; if Innings 2 → completeMatch()
- **Abandon Match** (red, Ban icon): finalises innings with `completedReason: 'abandoned'`; marks match completed with `resultText: 'Match Abandoned'`; navigates to summary
- Warning: "This cannot be undone"

### CloseMatchModal
- Three radio-style options: Team A wins / Team B wins / No Result
- Confirm button disabled until selection made
- `null` winner ID = No Result / tie; non-null = winning team

---

## 18. Batting Order Panel (BattingOrderPanel)

Collapsible panel on ScoringPage, placed below batsman/bowler panels, above OverTracker. Starts **collapsed** — header shows wicket count.

When expanded, four sections in order:
1. **At Crease** — ● Striker (gold label), Non-Striker; highlighted row background
2. **Retired Hurt** — HeartPulse icon, gold text, shows runs(balls)
3. **Out** — dismissal text in red/muted, dimmed name, runs(balls)
4. **Yet to Bat** — players not yet in battingOrder, "yet to bat" label, dimmed

---

## 19. UX Enhancements (applied)

These improvements were made after initial build to address usability gaps:

| Area | Enhancement |
|------|-------------|
| **Toast durations** | Errors 5s, warnings 4s, success/info 3s — critical messages stay visible longer |
| **InningsBreakModal** | "Start 2nd Innings" button shows loading spinner and is disabled during save — prevents double-tap |
| **NewOverModal** | Title shows over number ("Over 3 Complete — 8R 1W"); 1-eligible-bowler warning is a persistent yellow banner (AlertTriangle) instead of a vanishing toast; confirm button says "Start Over 4" |
| **Scoreboard** | Target bar has label row: "Target: 120" left / "Need 34" or "Target reached!" right |
| **WicketModal** | "Next Batsman In" has explicit placeholder "— Select batsman —" — no silent auto-selection; Retire Hurt replacement is clearly optional with "— No replacement now —" placeholder |
| **BowlerPanel** | Economy always shown — displays "0.0" at start of over instead of being hidden |
| **BatsmanPanel** | Strike-swap button labelled "Rotate Strike" instead of "swap" |
| **TeamsPage** | Toast confirms "Player X added" and "Team name updated" after mutations |
| **HistoryPage** | Export button shows toast confirming how many matches were exported |

### Additional UX rules
- All ball buttons disabled (`opacity-40`) when `currentBowlerId` is null; "Select Opening Bowler" gold button shown below
- Wicket flash: red background + "OUT!" overlay + `navigator.vibrate(200)` haptic
- Boundary flash: gold background + "FOUR!" / "SIX!" overlay for 800ms
- NewOverModal: previous bowler shown as disabled with "(prev)" label
- Deleted/dismissed players never appear as eligible batting options
- `isLastMan` guard: Retired Hurt tab hidden in WicketModal when only 1 batsman remains

---

## 20. DB Schema (Dexie v2 — current)

```ts
this.version(2).stores({
  matches:    'id, status, createdAt',
  innings:    'id, matchId, inningsNumber, status',
  deliveries: 'id, inningsId, overIndex, ballIndex, deliverySequence, timestamp',
  savedTeams: 'id, name, createdAt',
});
```

Repo split:
- `matchRepo.ts` — Match CRUD + `getActiveMatch`
- `inningsRepo.ts` — `getInnings`, `getMatchInnings`, `saveInnings`
- `playerRepo.ts` — delivery CRUD: `getInningsDeliveries`, `addDelivery`, `deleteLastDelivery`, `getAllDeliveries`
- `savedTeamRepo.ts` — SavedTeam CRUD + `addPlayerToTeam`, `removePlayerFromTeam`, `updatePlayerInTeam`

---

## 21. Undo — Full State Recomputation

`recomputeInningsLiveState(innings, deliveries)` is called after every undo. It re-derives the full live innings state from scratch:

1. **battingOrder** — rebuilt from delivery history, then appends any pre-known openers
2. **currentBatsmanIds** — first two undismissed batsmen from batting order
3. **strikerIndex** — full delivery-by-delivery simulation using `computeNextStrikerIndex`, handling wickets, run-outs, and end-of-over rotations
4. **currentBowlerId** — null if last over is complete (6 legal balls), else the bowler of the last delivery
5. **status** — reset to `'active'`; `completedReason` cleared
6. **retiredHurtIds** — carried forward as-is from innings object (not derivable from deliveries)

---

## 22. Component File Map

```
src/
  db/repos/
    matchRepo.ts          getAllMatches, getMatch, saveMatch, deleteMatch, getActiveMatch
    inningsRepo.ts        getInnings, getMatchInnings, saveInnings
    playerRepo.ts         getInningsDeliveries, addDelivery, deleteLastDelivery, getAllDeliveries
    savedTeamRepo.ts      getAllSavedTeams, getSavedTeam, saveSavedTeam, deleteSavedTeam,
                          addPlayerToTeam, removePlayerFromTeam, updatePlayerInTeam
  store/
    scoringStore.ts       loadInnings, scoreDelivery, undoLastDelivery, finaliseInnings,
                          rotateStrike, changeBatsman, changeBowler, retireHurt,
                          recallRetiredBatsman, clear
    teamsStore.ts         teams, loading, loadTeams, createTeam, updateTeam, removeTeam,
                          addPlayer, removePlayer, updatePlayer
    uiStore.ts            toasts (duration by severity), boundaryFlash, wicketFlash
  hooks/
    useScoring.ts         wraps scoringStore + selectNextBatsman helper
    useMatch.ts           match CRUD wrappers
    useTeams.ts           thin wrapper: export function useTeams() { return useTeamsStore(); }
  pages/
    HomePage.tsx          recent matches, resume card, new match CTA
    SetupPage.tsx         4-step wizard (Config → Teams → Rules → Toss)
    ScoringPage.tsx       live scoring, all modals, overflow menu
    ScorecardPage.tsx     full read-only scorecard (batting/bowling/FOW/over-by-over)
    SummaryPage.tsx       result + MOTM + share + confetti
    HistoryPage.tsx       search, filter, export JSON, delete
    TeamsPage.tsx         master roster + PlayerStatsModal
  components/
    scoring/
      Scoreboard.tsx           runs/wkts/overs + flash animations + target bar with labels
      BatsmanPanel.tsx         striker/non-striker rows + "Rotate Strike" button + tap-to-change
      BowlerPanel.tsx          O-M-R-W + economy (always shown) + tap-to-change
      BallButtons.tsx          0-6 pad + extras row + WICKET + long-press 4→5, long-press 6→penalty
      OverTracker.tsx          coloured delivery badges for current over
      WicketModal.tsx          dismissal types + fielder + run-out choice + explicit next batsman
                               + Retired Hurt tab (when rule enabled, not last man)
      ExtrasModal.tsx          wide/no-ball/bye/leg-bye + additional runs stepper
      NewOverModal.tsx         over number in title + over cap warning banner + "Start Over N" button
      InningsBreakModal.tsx    1st innings summary + openers select + loading state on start
      UndoBar.tsx              undo last delivery, clears NewOverModal
      BattingOrderPanel.tsx    collapsible: At Crease / Retired Hurt / Out / Yet to Bat
      ChangeBatsmanModal.tsx   Yet to Bat + Recall Retired Hurt sections
      ChangeBowlerModal.tsx    eligible/ineligible bowlers with stats
      CloseInningsModal.tsx    Declare (gold) / Abandon (red)
      CloseMatchModal.tsx      Team A / Team B / No Result radio options
    setup/
      MatchConfigStep.tsx      overs, players, single-player toggle
      TeamSetupStep.tsx        saved-team mode (pick + checkbox squad) OR manual mode
      TossStep.tsx             coin flip, winner, bat/bowl choice
      RulesStep.tsx            all street cricket rule toggles + sliders
    teams/
      PlayerStatsModal.tsx     career batting + bowling stat grids
    layout/
      AppShell.tsx             root layout + bottom nav
      TopBar.tsx               back + title + actions slot
      BottomNav.tsx            Home | History | Teams tabs
    common/
      Button.tsx               primary/secondary/danger/gold/ghost variants + loading state
      Modal.tsx                bottom-sheet, persistent prop prevents backdrop close
      Spinner.tsx
      Badge.tsx
      OfflineBanner.tsx
      InstallBanner.tsx
  utils/
    cricket.ts        computeInningsStats, computeNextStrikerIndex, isLegalDelivery,
                      buildResultText, ballSymbol, ballBadgeClass, formatOvers, bowlerOversDisplay
    playerStats.ts    computeCareerStats(playerId) → CareerStats, formatBestBowling
    format.ts         formatScore, formatOvers, formatDate, formatOversShort
    share.ts          buildShareText → WhatsApp-friendly ASCII scorecard
    cn.ts             clsx + twMerge helper
  types/
    match.types.ts    Match, MatchConfig, StreetCricketRules, Innings, Team, Toss, MatchResult
    delivery.types.ts Delivery, DeliveryExtras, Wicket, WicketType, InningsStats,
                      BatsmanScore, BowlerScore, FallOfWicket, OverSummary
    player.types.ts   Player, SavedPlayer, SavedTeam, PlayerRole, BatsmanScore, BowlerScore
```
