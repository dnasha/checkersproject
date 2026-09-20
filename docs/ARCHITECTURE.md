# Astra architecture

The original game by Dan Sharan is preserved in Git history (`main` at `50b6935` and `og-version`). This edition is a client-only TypeScript application, compiled to static files by Vite. No services or accounts are required.

## Boundaries

- `src/core/engine.ts`: the only rules authority. Numeric 32-square board, complete capture paths, reversible moves, outcome and draw detection. No DOM, clocks, or storage.
- `src/core/match.ts`: complete-turn history, unfinished human capture prefixes, monotonic clocks, undo, pause, import validation.
- `src/ai/`: bounded-memory search, evaluation, generated knowledge, cooperative worker protocol. The UI validates every result against its current session and position.
- `src/app.ts` and `src/styles.css`: semantic HTML, pointer/keyboard interaction, routing, presentation, and accessible feedback.
- `src/services/`: local persistence, portable game files, original synthesized sound, and offline updates.
- `src/content/learning.ts`: original exercises, with machine-checked solutions.

## Game semantics

Dark moves first. Men move and capture forward. Kings move one diagonal step or capture over an adjacent enemy. Captures are compulsory unless the optional-capture house rule is chosen. Choosing a capture always commits the player to its full sequence. There is no longest-capture requirement. Reaching the promotion row ends the turn, even if the new king could capture backwards.

Automatic draw adjudication is an app simplification of referee/claim-based rules: the same board and side to move for the third time, or 80 completed turns without a capture or an uncrowned-man move. Outcomes are checked after every complete turn. No-move/elimination wins take precedence over a draw threshold on that turn.

The core position remains at the start of a human multi-jump until its complete turn is selected. The UI renders a preview from the chosen prefix. This prefix is saved independently. On restore it must match at least one legal complete turn. History, draw counters, side changes, and increments are applied once.

## Clocks and saves

An epoch-compatible monotonic source measures elapsed time in the open page; saved timestamps allow elapsed time to be settled after reload. Clock ticks are for rendering, not the source of elapsed time. Every move settles its clock before validation; a timed-out search cannot play. Explicit pause cancels search, freezes clocks and hides the board. Hidden/closed tabs otherwise continue consuming time.

IndexedDB stores versioned records and learning progress; localStorage stores preferences and a small active-game recovery checkpoint. Import reconstructs the entire game from its initial board and legal turns. Serialized derived board state is never trusted. A corrupt record cannot break startup. There is no migration from the legacy game because it did not persist games.

## Search safety

One module worker handles move search, hints, analysis and pondering. Every message has a request ID, session ID and revision. Higher-priority tasks cancel lower-priority tasks. The search periodically yields to the worker event loop so it can receive stop or play-now messages.

Transposition score keys include board, turn, rules, no-progress count and repetition history. This prevents a score from a different draw context being reused as a cutoff. Complete-turn move generation is shared with the interface. Pondering retains useful search caches while invalidating obsolete jobs. Search cannot mutate the live match.

Difficulty controls search budget and bounded weaker choices; Expert uses the best completed iteration. Numeric scores are estimates measured in hundredths of an approximate man value. Finite-depth opening/endgame advice only affects ordering. Exact endgame results must satisfy draw-context guards.

## Deployment and offline updates

Both HTML entry points and all assets use relative URLs. The worker and service worker work below a GitHub Pages repository subpath. The production build generates its precache from emitted asset names. Updates wait until the player explicitly accepts them. All content is served by the same origin; no CDN, analytics, API keys or remote fonts are used.

The Pages workflow publishes only explicit `astra-v*` release tags or manual dispatches. Ordinary branch pushes and pull requests run CI without publishing.
