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
`{ id, name, location, numHoles, rating, slope, totalYardage, holes: [{ number, par, yardage }] }`

### Round
`{ id, courseId, courseName, numHoles, date, tees, courseRating, slopeRating, totalScore, holes: [{ number, par, score, putts, penalties, fairwayHit, fairwayDirection, gir, approachResult, sandSave }] }`

## Current Stats Computed
- Handicap Index (USGA: best N of last 20 differentials × 0.96)
- Average Score
- Fairways in Regulation % (non-par-3 holes only)
- Greens in Regulation %
- Average Putts per Round
- Scrambling % (par or better when missing GIR)

## Known Issues / TODOs
- No data visualization / charts yet (plan: Chart.js)
- Missing advanced golf KPIs: scoring by par type, putt analysis (1-putt%, 3-putt%), bounce-back rate, approach miss patterns, penalty analysis, sand save %, trends over time
- `viewRound()` uses `alert()` — needs a proper detail modal
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
