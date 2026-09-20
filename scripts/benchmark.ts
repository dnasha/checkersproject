import { cpus, platform, release } from "node:os";
import { writeFile } from "node:fs/promises";
import {
	applyTurnUnchecked,
	createInitialState,
	createState,
	getCoords,
	getLegalTurns,
	getOutcome,
	getSquare,
	isKing,
	sideOf,
	type GameState,
	type Turn,
} from "../src/core/engine";
import { MATE, referenceSearch, SearchEngine } from "../src/ai/search";

/** The source/AI.js material, advancement, center and distance heuristic, with
 * shared correct full-turn rules and terminal adjudication. No Astra features. */
function legacyEvaluate(state: GameState): number {
	const counts = [0, 0];
	const squares: number[][] = [[], []];
	let score = 0;
	for (let sq = 0; sq < 32; sq++) {
		const piece = state.board[sq];
		if (!piece) continue;
		const side = sideOf(piece) === "dark" ? 0 : 1;
		const [row, col] = getCoords(sq);
		counts[side]++;
		squares[side].push(sq);
		let value = isKing(piece) ? 300 : 100 + 5 * (side === 0 ? row : 7 - row);
		if (isKing(piece) && row >= 2 && row <= 5 && col >= 2 && col <= 5)
			value += 10;
		score += side === 0 ? value : -value;
	}
	if (counts[0] && counts[1] && counts[0] !== counts[1]) {
		let distance = 0;
		for (const dark of squares[0])
			for (const light of squares[1]) {
				const a = getCoords(dark);
				const b = getCoords(light);
				distance += Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
			}
		const average = distance / (counts[0] * counts[1]);
		score += counts[0] > counts[1] ? 5 * (7 - average) : 5 * average;
	}
	return score;
}

async function legacySearch(state: GameState, budgetMs: number): Promise<Turn> {
	let nodes = 0;
	const start = performance.now();
	function* visit(
		state: GameState,
		depth: number,
		alpha: number,
		beta: number,
		ply: number,
	): Generator<void, { score: number; move: Turn | null }, void> {
		if ((++nodes & 63) === 0) yield;
		const result = getOutcome(state);
		if (result)
			return {
				score: result.winner
					? (result.winner === "dark" ? 1 : -1) * (MATE - ply)
					: 0,
				move: null,
			};
		if (!depth) return { score: legacyEvaluate(state), move: null };
		const dark = state.turn === "dark";
		let best = dark ? -Infinity : Infinity;
		let chosen: Turn | null = null;
		for (const move of getLegalTurns(state)) {
			const result = yield* visit(
				applyTurnUnchecked(state, move),
				depth - 1,
				alpha,
				beta,
				ply + 1,
			);
			if (dark ? result.score > best : result.score < best) {
				best = result.score;
				chosen = move;
			}
			if (dark) alpha = Math.max(alpha, best);
			else beta = Math.min(beta, best);
			if (beta <= alpha) break;
		}
		return { score: best, move: chosen };
	}
	let chosen = getLegalTurns(state)[0];
	for (let depth = 1; depth <= 64; depth++) {
		const traversal = visit(state, depth, -Infinity, Infinity, 0);
		let next: ReturnType<typeof traversal.next>;
		for (;;) {
			const slice = performance.now() + 8;
			do {
				next = traversal.next();
			} while (
				!next.done &&
				performance.now() < slice &&
				performance.now() - start < budgetMs
			);
			if (next.done) break;
			if (performance.now() - start >= budgetMs) return chosen;
			await new Promise((resolve) => setTimeout(resolve, 0));
		}
		if (next.value.move) chosen = next.value.move;
		if (
			Math.abs(next.value.score) > MATE - 128 ||
			performance.now() - start >= budgetMs
		)
			break;
	}
	return chosen;
}

const budgetMs = Number(process.env.BENCH_BUDGET_MS || 100);
const pairs = Number(process.env.BENCH_PAIRS || 10);
const cap = Number(process.env.BENCH_PLY_CAP || 120);
const engine = new SearchEngine();
let referenceAgreements = 0;
let sample = createInitialState();
for (let index = 0; index < 8; index++) {
	engine.clear();
	if (engine.fixedDepth(sample, 3, false).score !== referenceSearch(sample, 3))
		throw new Error("Reference disagreement");
	referenceAgreements++;
	const legal = getLegalTurns(sample);
	sample = applyTurnUnchecked(sample, legal[(index * 7 + 3) % legal.length]);
}
const tacticalResults = [];
for (const [name, pieces, turn] of [
	[
		"Dark double capture",
		[
			[2, 1, 1],
			[3, 2, 3],
			[5, 4, 3],
		],
		"dark",
	],
	[
		"Light double capture",
		[
			[5, 6, 3],
			[4, 5, 1],
			[2, 3, 1],
		],
		"light",
	],
	[
		"Capture and crown",
		[
			[5, 0, 1],
			[6, 1, 3],
		],
		"dark",
	],
	[
		"King backward capture",
		[
			[5, 6, 2],
			[4, 5, 3],
		],
		"dark",
	],
] as const) {
	const board = Array<number>(32).fill(0);
	for (const [row, col, piece] of pieces) board[getSquare(row, col)] = piece;
	const state = createState(board, turn);
	const result = await engine.search(state, { budgetMs });
	const outcome = result?.move
		? getOutcome(applyTurnUnchecked(state, result.move))
		: null;
	tacticalResults.push({
		name,
		passed: outcome?.winner === turn,
		depth: result?.depth,
		nodes: result?.nodes,
	});
}

const games = [];
let totalNodes = 0;
let totalSearchMs = 0;
let maximumSearchMs = 0;
for (let pair = 0; pair < pairs; pair++) {
	let initial = createInitialState();
	let seed = (0x41535452 ^ Math.imul(pair + 1, 2654435761)) >>> 0;
	const openingPlies = 4 + (pair % 5) * 2;
	for (let ply = 0; ply < openingPlies; ply++) {
		seed ^= seed << 13;
		seed ^= seed >>> 17;
		seed ^= seed << 5;
		const legal = getLegalTurns(initial);
		if (getOutcome(initial))
			throw new Error("Benchmark opening terminated unexpectedly");
		initial = applyTurnUnchecked(initial, legal[(seed >>> 0) % legal.length]);
	}
	for (const astraSide of ["dark", "light"] as const) {
		engine.clear();
		let state = initial;
		let played = 0;
		for (; played < cap && !getOutcome(state); played++) {
			let move: Turn;
			if (state.turn === astraSide) {
				const result = (await engine.search(state, { budgetMs }))!;
				move = result.move!;
				totalNodes += result.nodes;
				totalSearchMs += result.elapsedMs;
				maximumSearchMs = Math.max(maximumSearchMs, result.elapsedMs);
			} else move = await legacySearch(state, budgetMs);
			state = applyTurnUnchecked(state, move);
		}
		const outcome = getOutcome(state);
		const result = !outcome
			? "unresolved"
			: !outcome.winner
				? "draw"
				: outcome.winner === astraSide
					? "win"
					: "loss";
		const game = {
			pair: pair + 1,
			openingPlies,
			astraSide,
			result,
			reason: outcome?.reason ?? "benchmark-ply-cap",
			plies: played,
		};
		games.push(game);
		console.log(JSON.stringify(game));
	}
}
const report = {
	measuredAt: new Date().toISOString(),
	hardware: {
		cpu: cpus()[0]?.model,
		logicalCpus: cpus().length,
		os: `${platform()} ${release()}`,
		node: process.version,
	},
	method:
		"Paired colors from ten seeded 4-to-12-ply openings. Both engines use the same per-move wall-clock budget and legal complete-turn engine. Legacy uses the original source/AI.js heuristic and alpha-beta, plus iterative deepening for equal time and corrected terminal rules. Astra uses no pondering or opening/endgame data in this benchmark. Small sample; not an Elo estimate.",
	budgetMs,
	pairs,
	plyCap: cap,
	reference: {
		agreed: referenceAgreements,
		tested: 8,
		depth: 3,
		quiescence: false,
	},
	tacticalResults,
	games,
	totals: {
		wins: games.filter((g) => g.result === "win").length,
		draws: games.filter((g) => g.result === "draw").length,
		losses: games.filter((g) => g.result === "loss").length,
		unresolved: games.filter((g) => g.result === "unresolved").length,
	},
	search: {
		totalNodes,
		totalSearchMs: Math.round(totalSearchMs),
		nodesPerSecond: Math.round(totalNodes / (totalSearchMs / 1000)),
		maximumSearchMs: Math.round(maximumSearchMs),
		cacheBytes: engine.cacheBytes,
	},
};
await writeFile(
	"scripts/benchmark-results.json",
	JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
