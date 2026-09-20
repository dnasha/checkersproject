# Astra validation

Validated locally on Windows 11, Intel Core i7-13620H (16 logical CPUs), Node 25.2.1, using the production build beneath `/checkersproject/`. The GitHub workflows use Node 24 LTS. No release was published.

## Automated checks

- TypeScript strict checks, Biome lint, and Vite production build pass.
- 104 Vitest tests cover complete legal turns, branching captures, promotion, optional captures, terminal states, draw boundaries, elapsed clocks, undo, imported records, storage recovery, all lessons and puzzles, search agreement, and the exact two-piece database.
- All 22 production Chromium tests pass. They cover both HTML entry points; 320, 390, 640, 768, 813, 1024 and 1440 px layouts; reduced motion; keyboard and textual moves; real touch dragging; complete-turn and partial-capture reload; modes and assistance restrictions; replay and saved-game isolation; malformed links; worker failure and retry; timed pause/reload/timeout and increments; delayed startup and deletion/autosave races.
- Axe checks report no WCAG A/AA violations in light, dark and high-contrast appearances, including numbered squares on a light board palette, preferences, learning, editor, library and result dialogs.
- Worker tests check subpath URLs, all knowledge assets, stale-result rejection, cancellation, legal analysis alternatives, short-clock budgets, and under-100-ms main-thread response during pondering.
- Offline preparation followed by network disconnection, reload, local play and a computer response passes. No runtime external services are used.

The compressed application JavaScript and CSS, **including the worker**, total approximately **40 KB**, against the 200 KB limit. Original knowledge assets total approximately **303 KB uncompressed**, separately loaded by the engine and included in offline preparation.

Run the current suites with `npm test`, `npm run build`, `npm run test:e2e`, and `npm run check:size`. Browser traces, failure screenshots and reports are written to ignored `test-results/` and `playwright-report/` directories. CI repeats these checks; the manual Pages workflow also gates publication on them.

## Strength evidence

See [engine measurements](ENGINE.md) and the checked-in raw benchmark report. At equal 100-ms budgets across 20 paired-color games, Astra recorded 11 wins, one draw, one loss and seven games unresolved at the 120-ply cap. This is a limited regression comparison, without pondering or knowledge assets; it is not an Elo rating. Exact knowledge covers two pieces; three-piece guidance is sparse rather than exhaustive.

## Release checks requiring human hardware

Keyboard behavior, accessible names, live-region structure, contrast and touch events were checked in Chromium. An actual NVDA/VoiceOver listening session, physical iOS/Android play, Firefox/WebKit, browser UI zoom, and installing/updating the PWA on those devices have **not** been manually verified. Narrow viewport tests establish reflow, but do not replace those assistive-technology and device checks.

The live GitHub Pages deployment and its repository settings remain unchanged. The new manual deployment workflow must be run deliberately for a release; local subpath tests do not claim a live deployment happened.
