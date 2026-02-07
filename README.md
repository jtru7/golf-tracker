# Golf Stats Tracker

A personal golf statistics tracking web app. Log rounds hole-by-hole, track key performance indicators, and sync data to Google Sheets — no database or server required.

## Features

### Current (v0.1.0)
- **Hole-by-hole round logging** — score, putts, penalties, fairway direction (left/hit/right), approach result (GIR/long/short/left/right), sand saves
- **Dashboard stats** — handicap index (USGA formula), average score, fairways hit %, GIR %, putts per round, scrambling %
- **Course management** — add/edit/delete courses with per-hole par and yardage (9 or 18 holes)
- **Date and tee filters** on dashboard
- **Data export** to JSON
- **localStorage persistence** — works offline, no account needed

### Planned
- Google Sheets sync via Google Apps Script (replace current API key approach)
- Advanced stats: scoring by par type, putting analysis, miss pattern heatmaps, trend charts
- Chart.js visualizations for performance over time

## Quick Start

1. Clone the repo
2. Open `index.html` in a browser
3. Add a course under the **Courses** tab
4. Log a round under **New Round**
5. View your stats on the **Dashboard**

No build tools, no npm, no server — just open the file.

## Project Structure

```
golf-tracker/
├── index.html        # App shell (HTML structure)
├── css/
│   └── styles.css    # All styles
├── js/
│   └── app.js        # All application logic
├── assets/           # Images, icons (future use)
├── CHANGELOG.md      # Version history
├── CLAUDE.md         # AI assistant context
└── LICENSE           # MIT
```

## Tech Stack

- **HTML/CSS/JS** — vanilla, no frameworks
- **localStorage** — primary data store
- **Google Fonts** — Crimson Pro (headings), Montserrat (body)
- **Google Sheets** — backup/sync layer (planned: via Apps Script)

## For Buddies Who Want Their Own Copy

1. Fork this repo
2. Open `index.html` — you're done
3. (Optional) Set up your own Google Sheet + Apps Script for cloud backup

All data lives in your browser's localStorage. Each person's copy is completely independent.

## License

MIT — see [LICENSE](LICENSE)
