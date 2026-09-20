# Astra Checkers

A little checkers club, entirely in your browser. A new edition of Dan Sharan's original game, built with TypeScript, HTML and CSS. It runs on GitHub Pages, works offline after preparation, and never needs an account, backend or API key.

[Play Astra Checkers](https://dnasha.github.io/checkersproject/) · [Release and deployment guide](docs/DEPLOYMENT.md)

## Play

Choose Practice, Challenge or two-player Local play before starting. Practice includes hints and takebacks; Challenge keeps assistance out of the live match. Pick either side, four AI levels, standard American/English rules or optional captures, and untimed, 3+3, 5+3 or 10+5 clocks.

- Responsive, keyboard-accessible board with a text move selector, drag/tap input, explicit king symbols and high-contrast appearance.
- Background AI with pondering, iterative search, cancellation and Play now. Untimed Expert thinks for up to ten seconds; lower levels move sooner.
- Six interactive lessons, 24 original puzzles, a position editor, replay and on-demand analysis.
- Local game library, automatic resume, JSON import/export, standard-game PDN export and shareable position links.
- Original synthesized sounds, named board palettes, offline installation and controlled updates.

The app automatically adjudicates threefold repetition and 80 completed turns with neither a capture nor an uncrowned-man move. A capture chain counts as one turn. Dark moves first, and crowning ends the turn. Optional captures are a house rule; once started, a capture sequence must finish.

## Run and check

Use Node.js 22.12+ or 24 LTS and npm. Build tooling is only needed for development; visitors receive static files.

```sh
npm ci
npm start
```

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

`npm run preview` serves the production build. `node scripts/serve-preview.mjs` serves it at `http://127.0.0.1:4173/checkersproject/`, the repository-subpath configuration used by browser tests. Open through HTTP(S); opening a compiled file directly with `file://` is not supported.

See [validation results and remaining device checks](docs/VALIDATION.md) for measured coverage and release limitations.

## Publish to GitHub Pages

Build output is in `dist/`; both `index.html` and the older `game.html` link work. Set the repository's Pages source to **GitHub Actions**. Publication requires an explicit `astra-v*` release tag, or a manual run of **Publish Astra to Pages**. Ordinary pushes to `astra-ver` do not publish it. No server routes or special response headers are required.

To publish from `astra-ver` while preserving `main`, commit and push the tested branch, allow the intended release tag in **Settings → Environments → github-pages → Deployment branches and tags**, then create and push a new release tag:

```sh
git switch astra-ver
git push origin astra-ver
git tag -a astra-v2.0.1 -m "Release Astra Checkers 2.0.1"
git push origin astra-v2.0.1
```

Use a new tag name for each release. The workflow rebuilds, tests, and deploys the tagged commit. The **Run workflow** button becomes available once this workflow file also exists on the repository's default branch; GitHub requires that for manual dispatch. Release-tag deployment works directly from `astra-ver`.

The service worker prepares offline assets after first loading the production build. Wait for the offline-ready indication before disconnecting. A newer version waits for explicit acceptance; it does not interrupt a running game.

## Data and controls

Everything stays on the device. Preferences use localStorage; matches and learning progress use IndexedDB. Export games before clearing browser data. Storage failures leave play available in memory. Timed games keep consuming time when hidden or closed; use Pause before stepping away. Changing the device clock can affect elapsed time across browser sessions, so these local clocks are not intended as anti-cheat tournament clocks.

Keyboard: Tab to enter or leave the board, arrows to explore, Enter/Space to select and move, Escape to cancel selection. Multi-jumps must complete with the same piece. The legal-move dropdown is an equivalent non-spatial way to play.

## Engine and measurements

`npm run benchmark` runs deterministic tactical checks, shallow reference-search comparisons, and paired games against a corrected implementation of the legacy evaluation and plain alpha-beta search. The generated `scripts/benchmark-results.json` records budgets, hardware, results and unresolved games. This is a reproducible comparison, not an Elo estimate or a claim of perfect play.

`npm run generate:knowledge` rebuilds the original opening/endgame guidance. Runtime knowledge files are shipped with the app; they require no external downloads. Finite-depth guidance is not treated as a proven result. See [engine measurements](docs/ENGINE.md) for results, hardware and knowledge coverage, and [architecture](docs/ARCHITECTURE.md) for rules, persistence and search details.

The pre-rebuild code remains available in Git history at `50b6935`; the much earlier project is on `og-version`. Original authorship and the MIT license are preserved.
