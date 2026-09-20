# Engine and measured results

Astra's computer opponent runs in one persistent module worker. Iterative
deepening, principal-variation alpha-beta search, aspiration windows, capture
quiescence, move ordering and a fixed 5 MiB transposition table keep the interface
responsive. Search yields cooperatively, and cancellation discards unfinished
iterations. Evaluation includes material, mobility, promotion routes, piece
support, back-rank defense and endgame conversion. Expert may ponder during the
human turn; hidden pages, pause and replay stop that work.

Explicit analysis searches every root alternative with a full window and reports
the top three lines from the last completed iteration. Scores are estimates from
Dark's perspective; 100 units are roughly one man. They are not win percentages.

## Original, self-contained knowledge

| Dataset | Coverage | Uncompressed bytes |
| --- | --- | ---: |
| Opening recommendations | 128 positions, generated at depth 4 | 11,640 |
| Sparse endgame recommendations | 1,024 positions with 2–3 pieces, depth 6 | 93,325 |
| Exact two-piece tablebase | All 13,952 legal one-versus-one positions | 198,113 |

The exact tablebase covers men and kings, both moving sides, and both capture
settings. Retrograde analysis gives win/draw/loss and distance to terminal,
minimizing winning distance and maximizing resistance when losing. Tests verify
the minimax and distance equations for every entry.

A tablebase win/loss is accepted as proven only when its decreasing-distance
strategy fits within the remaining no-progress allowance and no historical
position has occurred twice. Otherwise its legal move is only ordering guidance
and the ordinary search evaluates the live draw context. Tablebase draws never
override live adjudication. Three-piece coverage is sparse guidance, **not a
complete three-piece tablebase**. Missing data does not prevent ordinary play.

Regenerate all original datasets with `npm run generate:knowledge`. No external
engine, opening database or service is used.

## Benchmark

The recorded run on September 20, 2026 used an Intel Core i7-13620H with 16 logical
CPUs, Windows 11 (10.0.26200), and Node 25.2.1. Both engines received **100 ms per
move**. Twenty games paired colors from ten reproducibly seeded openings of
4–12 plies. The corrected legacy baseline retains the historical game's
evaluation and ordinary alpha-beta, with shared legal complete turns, terminal
adjudication and iterative deepening for equal-time comparison. Astra's benchmark
did not use pondering or any knowledge datasets.

| Result | Count |
| --- | ---: |
| Astra wins | 11 |
| Draws | 1 |
| Astra losses | 1 |
| Unresolved at the 120-ply benchmark cap | 7 |

Search averaged **29,672 nodes/second**, with a maximum observed 118 ms search
duration for the 100 ms budget. All four tactical fixtures and all eight shallow
minimax reference comparisons passed. This small sample is a regression
benchmark, not an Elo rating or a general strength guarantee; unfinished games
are not counted as draws. Timing depends on the device and current load.

Run `npm run benchmark` to reproduce the harness. `BENCH_BUDGET_MS`, `BENCH_PAIRS`
and `BENCH_PLY_CAP` customize it. Full per-game results and hardware are recorded
in [the raw report](../scripts/benchmark-results.json).
