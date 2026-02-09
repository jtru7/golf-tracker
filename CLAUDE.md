# Golf Stats Tracker — AI Context

## What This Is
A personal golf statistics web app for tracking rounds, courses, and performance KPIs. Designed to run as a static site (open `index.html` in a browser) with no database — data lives in localStorage and will sync to Google Sheets via Apps Script.

## Tech Stack
- Vanilla HTML, CSS, JavaScript — no frameworks, no build tools
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
- `assets/` — reserved for images/icons
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
`{ id, courseId, courseName, numHoles, date, tees, roundType, courseRating, slopeRating, totalScore, holes: [{ number, par, score, putts, puttDistances, penalties, fairwayHit, fairwayDirection, gir, approachResult, bunker }] }`
- `roundType`: one of `"normal"`, `"league"`, `"casual"`, `"scramble"`. Normal and League count toward handicap; Casual and Scramble do not. Old rounds without this field are treated as `"normal"`.
- `puttDistances`: optional array of distances in feet for each putt (e.g., `[25, 4, 1]`). Last entry = made putt. `null` entries for unfilled distances. Missing/undefined on older rounds.
- `bunker`: boolean, true if player hit into a bunker on this hole. Sand save % is auto-calculated (score <= par when bunker=true). Old rounds with `sandSave` field are auto-migrated.

## Current Stats Computed (in `js/stats.js`)
All stats normalized **per 9 holes** where applicable (user plays 80-85% 9-hole rounds).

### Overview
- Handicap Index (USGA: best N of last 20 differentials × 0.96; only normal + league rounds)
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
- Bounce-back Rate (birdie or better after bogey+)
- Penalties per 9

## Features Implemented
- **Dashboard with 5 KPI sections**: Overview, Off the Tee, Approach Play, Putting, Scoring — all dynamically rendered with distribution bars
- Round types: Normal, League Match, Casual, Scramble (Normal + League count toward handicap)
- Editable rounds: click a round → detail modal → Edit button → pre-populated form
- Multi-tee course setup (Red/White/Blue with per-tee rating, slope, yardage, hole handicaps)
- Putt distance tracking per hole (distance for each putt attempt)
- Bunker/sand save tracking per hole
- Google Sheets sync via Apps Script web app
- Number input spinners hidden on hole cards to prevent scroll accidents
- Dashboard filters: date range, last N rounds

## Planned KPIs (Next Phase)

### Course-Level Stats (Courses page)
- Scoring avg per course (overall and vs par)
- Best/worst score per course
- Rounds played count
- Hardest/easiest holes ranking

### Hole-Level Stats (drill into a course)
- Scoring avg per hole (and vs par)
- Scoring distribution per hole
- Fairway hit % and common miss direction per hole
- GIR % and common miss direction per hole
- Avg putts per hole

## Known Issues / TODOs
- No data visualization / charts yet (plan: Chart.js)
- Test course is hardcoded in `init()` — should be removable
- No input validation on course creation (empty name allowed)
- Inline styles in JS template literals — consider moving to CSS classes

## Coding Conventions
- Functions use camelCase
- IDs use camelCase (e.g., `courseSelect`, `roundDate`)
- CSS uses kebab-case with BEM-light naming
- CSS custom properties defined in `:root` for theming
- No semicolons enforcement (current code uses them)
- Template literals for HTML generation
