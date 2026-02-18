# Golf Stats Tracker — AI Context

## What This Is
A personal golf statistics web app for tracking rounds, courses, and performance KPIs. Designed to run as a static site (open `index.html` in a browser) with no database — data lives in localStorage and will sync to Google Sheets via Apps Script.

## Tech Stack
- Vanilla HTML, CSS, JavaScript — no frameworks, no build tools
- Chart.js v4 for trendline charts (loaded locally from `assets/chart.umd.js`)
- localStorage for primary data persistence
- Google Sheets sync via Google Apps Script web app (see `google-apps-script/Code.gs`)
- Google Fonts: Crimson Pro (headings/display), Montserrat (body/UI)
- Vitest for unit testing (`npm test`)
- npm for dev tooling only (no runtime dependencies)

## File Structure
- `index.html` — HTML shell, links to CSS and JS
- `css/styles.css` — all styles, CSS custom properties for theming
- `js/app.js` — DOM interaction, event handlers, rendering
- `js/stats.js` — pure calculation functions (testable, no DOM access)
- `assets/` — images/icons and Chart.js library (`chart.umd.js`)
- `google-apps-script/Code.gs` — Apps Script to deploy in Google Sheets for read/write sync
- `tests/stats.test.js` — Vitest unit tests for stats.js

## Architecture
- Single global `appData` object holds all state: `{ courses, rounds, settings: { webAppUrl } }`
- `saveToLocalStorage()` / `loadFromLocalStorage()` for persistence
- Views are toggled via `showView()` — dashboard, new-round, courses, settings
- Course and round data are rendered via DOM innerHTML construction
- Hole input uses toggle buttons (fairway: left/hit/right, approach: GIR/long/short/left/right)

## Data Model
### Course
```
{
  id, name, location, numHoles,
  holes: [{ number, par }],
  tees: {
    red:   { enabled: bool, rating, slope, totalYardage, yardages: [int...], handicaps: [int...] },
    white: { enabled: bool, rating, slope, totalYardage, yardages: [int...], handicaps: [int...] },
    blue:  { enabled: bool, rating, slope, totalYardage, yardages: [int...], handicaps: [int...] }
  }
}
```
- Par is shared across all tees; yardages and hole handicaps are per-tee
- Each tee set is optional (enabled flag)
- Old courses with `course.rating`/`course.slope`/`holes[].yardage` are auto-migrated to `tees.white` on load

### Round
`{ id, courseId, courseName, numHoles, date, tees, roundType, courseRating, slopeRating, totalScore, holes: [{ number, par, score, putts, puttDistances, penalties, fairwayHit, fairwayDirection, gir, approachResult, bunker, matchResult }] }`
- `roundType`: one of `"normal"`, `"league"`, `"casual"`, `"scramble"`, `"match_play"`. Normal, League, and Match Play count toward handicap; Casual and Scramble do not. Old rounds without this field are treated as `"normal"`.
- `matchResult`: per-hole match play result — `'win'`, `'draw'`, `'loss'`, or `null`. Only set for League Match and Match Play round types. W/D/L toggle appears on hole cards for these types.
- `puttDistances`: optional array of distances in feet for each putt (e.g., `[25, 4, 1]`). Last entry = made putt. `null` entries for unfilled distances. Missing/undefined on older rounds.
- `bunker`: boolean, true if player hit into a bunker on this hole. Sand save % is auto-calculated (score <= par when bunker=true). Old rounds with `sandSave` field are auto-migrated.

## Current Stats Computed (in `js/stats.js`)
All stats normalized **per 9 holes** where applicable (user plays 80-85% 9-hole rounds).

### Overview
- Handicap Index (USGA: best N of last 20 differentials × 0.96; only normal, league, and match_play rounds)
- Average Score
- Bogey Avoidance % (holes scored par or better / total holes)
- Par Conversion % (GIR → par or better, measures finishing ability)

### Off the Tee
- Fairways in Regulation % (non-par-3 holes only)
- Fairway distribution bar (Left% / Hit% / Right%)

### Approach Play
- Greens in Regulation %
- Approach distribution bar (GIR% / Long% / Short% / Left% / Right%)
- Average First Putt Distance (approach proximity)
- Scrambling % (par or better when missing GIR)
- Sand Save % (par or better when in bunker)

### Putting
- Putts per 9
- Putting breakdown bar (1-putt% / 2-putt% / 3-putt% / 3+%)
- Feet of Putts Made per 9

### Scoring
- Scoring avg by par type (par 3 / par 4 / par 5 with vs-par)
- Scoring distribution bar (Eagle+ / Birdie / Par / Bogey / Double / Triple+)
- Bounce-back Rate (par or better after bogey+)
- Penalties per 9

### Match Play (conditional — only shows when match data exists)
- Matches Played, Points / 9, Hole Win %
- W/D/L distribution bar (Win=green, Draw=gold, Loss=red)
- Holes Won / Drawn / Lost counts, Total Points, Avg Points / Match
- `computeMatchPlayStats()` in stats.js — filters rounds with `matchResult` data

## Features Implemented
- **Dashboard with 6 KPI sections**: Overview, Off the Tee, Approach Play, Putting, Scoring, Match Play (conditional) — all dynamically rendered with distribution bars
- **KPI Goals**: Set personal targets for 16 KPIs in Settings with customizable thresholds. Dashboard cards show color-coded backgrounds (dark green = well above, light green = at goal, yellow = slightly below, red = well below). Configured via `GOAL_DEFS` in stats.js, rendered by `goalBadge()` helper in renderDashboard(), managed by `renderGoalsForm()` / `saveGoals()` in Settings. Goals stored in `appData.settings.goals`.
- **Putting Analytics**: Par Conversion moved to Putting section. Putt Make Rate by Distance table (6 buckets: inside 3ft / 3-6 / 6-10 / 10-15 / 15-20 / 20+). Lag Putting cards (3-Putt Avoidance %, Avg Lag Leave ft) for first putts 20+ ft.
- **Course Detail Modal**: click a course → modal with course-level KPIs, hole difficulty ranking, and hole-by-hole breakdown table (scoring avg, distribution, fairway %, GIR %, avg putts, miss direction arrows). Includes conditional Match Play section with W-D-L record, total points, hole win %, and per-hole W/D/L percentages in the breakdown table.
- **Course drag-and-drop reordering**: Drag handle on course cards, `reorderArray()` utility in stats.js, container-level event prevention to avoid DOM nesting
- **Chart.js Trendlines**: 6 KPIs (Score, Putts/9, Fairway %, GIR %, Scrambling %, Handicap) have a trend icon on their dashboard card. Clicking opens a modal with a Chart.js line chart showing raw per-round data overlaid with a 5-round moving average. `TREND_KPIS` constant, `computeTrendData()`, and `computeMovingAverage()` in stats.js. Handicap trend uses all rounds; other KPIs respect dashboard filters.
- **Recent Rounds**: Dashboard shows last 20 rounds; "View All Rounds" button opens modal with full scrollable list. `renderRoundItem()` extracted as reusable function.
- `computeCourseStats()` in stats.js — per-course and per-hole aggregation, delegates to `computeStats()` for dashboard-style KPIs
- **Match Play**: 5th round type with per-hole Win/Draw/Loss tracking. W/D/L toggle appears on hole cards for League Match and Match Play round types. `computeMatchPlayStats()` in stats.js computes points (W=1, D=0.5, L=0), win %, and per-9 normalization. Dashboard shows Match Play section only when match data exists. Round detail scorecard shows colored Match row (W/D/L) between Score and Putts. Course detail modal shows per-course match play stats and per-hole W/D/L %.
- Round types: Normal, League Match, Match Play, Casual, Scramble (Normal, League, Match Play count toward handicap)
- Editable rounds: click a round → detail modal → Edit button → pre-populated form
- Multi-tee course setup (Red/White/Blue with per-tee rating, slope, yardage, hole handicaps)
- Putt distance tracking per hole (distance for each putt attempt)
- Bunker/sand save tracking per hole
- Google Sheets sync via Apps Script web app (multi-tee format, auto-push on save)
- Number input spinners hidden on hole cards to prevent scroll accidents
- Dashboard filters: date range, last N rounds
- **Dark Mode**: Light/Dark theme toggle in Settings. Uses `[data-theme="dark"]` on `<html>` to override 21 CSS custom properties. `applyTheme()` / `changeTheme()` in app.js. Chart.js colors read from CSS variables via `getComputedStyle()`. Theme persisted in `appData.settings.theme`. Tee colors (red/white/blue) stay fixed as golf standards.

## Known Issues / TODOs
- No input validation on course creation (empty name allowed)
- Inline styles in JS template literals — consider moving to CSS classes

## Coding Conventions
- Functions use camelCase
- IDs use camelCase (e.g., `courseSelect`, `roundDate`)
- CSS uses kebab-case with BEM-light naming
- CSS custom properties defined in `:root` for theming
- No semicolons enforcement (current code uses them)
- Template literals for HTML generation
