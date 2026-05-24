# TCG Binder

A desktop app for tracking your TCG card collection. Supports multiple binders, automatic card images and pricing from the Pokémon TCG API, and marketplace links for buying/selling.

## Download

Go to the [Releases](https://github.com/humanporkrind/TCG-Binder/releases) page to download the latest version.

| Platform | File |
|----------|------|
| macOS (Intel + Apple Silicon) | `TCG Binder-x.x.x-universal.dmg` |
| Windows (x64) | `TCG Binder-x.x.x-win.zip` — extract and run `TCG Binder.exe` |

## Features

- **Multiple binders** — organise different sets or collections separately
- **Card grid** — customisable grid size (3×3 to 5×5) with owned/missing tracking
- **Right-click to toggle owned** — quick toggle without opening the card detail
- **Card conditions** — NM, LP, MP, HP, DMG per owned card
- **Auto images** — card art fetched automatically from the Pokémon TCG API
- **Weekly price cache** — TCGPlayer and Cardmarket prices fetched once per week and stored locally
- **Marketplace links** — open any card directly on Cardmarket or TCGPlayer (configurable)
- **Light / Dark theme**
- **Analytics view** — completion %, value breakdown by set/rarity/year
- **Import / Export** — CSV card lists, JSON owned data, full binder backup/restore

## Getting Started

### macOS
1. Download the `.dmg` file from Releases
2. Open it and drag **TCG Binder** to your Applications folder
3. Launch the app — a default binder is created automatically

### Windows
1. Download the `.zip` file from Releases
2. Extract the folder anywhere (e.g. `C:\Program Files\TCG Binder`)
3. Run `TCG Binder.exe`

> **Note:** Windows SmartScreen may warn about an unrecognised app on first launch — click **More info → Run anyway**.

## Building from Source

Requires Node.js 18+ and npm.

```bash
git clone https://github.com/humanporkrind/TCG-Binder.git
cd TCG-Binder
npm install
npm run dev          # development mode
npm run dist:mac     # build macOS DMG
npm run dist:win     # build Windows zip
```

## Data Storage

Card data, owned records, and cached prices are stored in a local SQLite database:

- **macOS:** `~/Library/Application Support/tcg-binder/tcg-binder.db`
- **Windows:** `%APPDATA%\tcg-binder\tcg-binder.db`

Card images uploaded manually are stored in the `images/` subfolder alongside the database. API-sourced images are stored as URLs and require an internet connection to display.

## Tech Stack

- [Electron](https://www.electronjs.org/) + [electron-vite](https://electron-vite.org/)
- [React](https://react.dev/) + TypeScript
- [Zustand](https://zustand-demo.pmnd.rs/) for state
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) for local storage
- [Pokémon TCG API](https://pokemontcg.io/) for card images and prices

## License

MIT
