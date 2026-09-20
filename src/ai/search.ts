import {
	getLegalTurns,
	getOutcome,
	makeTurn,
	positionKey,
	unmakeTurn,
	type GameState,
	type Turn,
} from "../core/engine";
import { evaluate } from "./evaluate";
import { Knowledge } from "./knowledge";
import type { AnalysisAlternative, Difficulty } from "./protocol";

export const MATE = 30000;
const INF = 32000;
const TABLE_SIZE = 1 << 18;
type NodeResult = { score: number; pv: Turn[] };
type Traversal = Generator<void, NodeResult, void>;
export interface SearchInfo extends NodeResult {
	move: Turn | null;
	depth: number;
	nodes: number;
	elapsedMs: number;
	alternatives?: AnalysisAlternative[];
}
export interface SearchControl {
	cancelled: boolean;
	finish: boolean;
}
export interface SearchOptions {
	budgetMs: number;
	level?: Difficulty;
	maxDepth?: number;
	quiescence?: boolean;
	multiPV?: boolean;
	control?: SearchControl;
	onProgress?: (result: SearchInfo) => void;
}
interface Context {
	state: GameState;
	nodes: number;
	quiescence: boolean;
	level: Difficulty;
	multiPV: boolean;
	rootScores: { turn: Turn; score: number; pv: Turn[] }[];
	history: Int32Array;
	killers: number[][];
}

export function turnCode(turn: Turn): number {
	let result = turn.from + 1;
	for (const square of turn.path) result = Math.imul(result, 37) + square + 1;
	return result >>> 0;
}

/** Both the entire repetition context and half-move clock participate in the key. */
export function searchKey(state: GameState): [number, number] {
	const source = `${positionKey(state)}|${state.noProgress}|${Object.keys(
		state.repetitions,
	)
		.sort()
		.map((key) => `${key}:${state.repetitions[key]}`)
		.join(";")}`;
	let a = 2166136261;
	let b = 2246822519;
	for (let i = 0; i < source.length; i++) {
		a = Math.imul(a ^ source.charCodeAt(i), 16777619);
		b = Math.imul(b ^ source.charCodeAt(i), 3266489917);
	}
	return [a >>> 0, b >>> 0];
}

/** Fixed typed storage: 5 MiB, independent of game duration or ponder time. */
class Transpositions {
	keysA = new Uint32Array(TABLE_SIZE);
	keysB = new Uint32Array(TABLE_SIZE);
	moves = new Uint32Array(TABLE_SIZE);
	scores = new Int32Array(TABLE_SIZE);
	depths = new Int16Array(TABLE_SIZE);
	bounds = new Uint8Array(TABLE_SIZE); // 0 absent, 1 exact, 2 lower, 3 upper
	ages = new Uint8Array(TABLE_SIZE);
	age = 0;
	get bytes(): number {
		return (
			this.keysA.byteLength +
			this.keysB.byteLength +
			this.moves.byteLength +
			this.scores.byteLength +
			this.depths.byteLength +
			this.bounds.byteLength +
			this.ages.byteLength
		);
	}
	clear(): void {
		this.bounds.fill(0);
	}
	find(a: number, b: number): number {
		const slot = a & (TABLE_SIZE - 1);
		return this.bounds[slot] && this.keysA[slot] === a && this.keysB[slot] === b
			? slot
			: -1;
	}
	save(
		a: number,
		b: number,
		depth: number,
		score: number,
		bound: number,
		move: number,
	): void {
		const slot = a & (TABLE_SIZE - 1);
		if (
			this.bounds[slot] &&
			this.ages[slot] === this.age &&
			this.depths[slot] > depth + 2
		)
			return;
		this.keysA[slot] = a;
		this.keysB[slot] = b;
		this.scores[slot] = score;
		this.depths[slot] = depth;
		this.bounds[slot] = bound;
		this.moves[slot] = move;
		this.ages[slot] = this.age;
	}
}

function mateToTable(score: number, ply: number): number {
	return score > MATE - 1000
		? score + ply
		: score < -MATE + 1000
			? score - ply
			: score;
}
function mateFromTable(score: number, ply: number): number {
	return score > MATE - 1000
		? score - ply
		: score < -MATE + 1000
			? score + ply
			: score;
}
function clone(state: GameState): GameState {
	return {
		...state,
		board: [...state.board],
		rules: { ...state.rules },
		repetitions: { ...state.repetitions },
	};
}

function terminal(state: GameState, ply: number): number | null {
	const result = getOutcome(state);
	if (!result) return null;
	if (!result.winner) return 0;
	return result.winner === state.turn ? MATE - ply : -MATE + ply;
}

export class SearchEngine {
	private table = new Transpositions();
	private lastQuiescence = true;
	readonly knowledge = new Knowledge();
	get cacheBytes(): number {
		return this.table.bytes;
	}
	clear(): void {
		this.table.clear();
	}

	private context(state: GameState, options: SearchOptions): Context {
		const quiescence = options.quiescence !== false;
		if (quiescence !== this.lastQuiescence) this.table.clear();
		this.lastQuiescence = quiescence;
		this.table.age = (this.table.age + 1) & 255;
		return {
			state: clone(state),
			nodes: 0,
			quiescence,
			level: options.level ?? "expert",
			multiPV: options.multiPV ?? false,
			rootScores: [],
			history: new Int32Array(32 * 32),
			killers: [],
		};
	}

	private order(
		context: Context,
		moves: Turn[],
		best: number,
		ply: number,
	): Turn[] {
		const state = context.state;
		return moves
			.map((turn) => {
				const code = turnCode(turn);
				let weight = code === best ? 1000000 : 0;
				weight += turn.captures.length * 10000 + (turn.promotion ? 8000 : 0);
				for (const square of turn.captures)
					weight += state.board[square] % 2 === 0 ? 300 : 100;
				if (context.killers[ply]?.includes(code)) weight += 5000;
				weight +=
					context.history[turn.from * 32 + turn.path[turn.path.length - 1]];
				return { turn, weight };
			})
			.sort((a, b) => b.weight - a.weight)
			.map((entry) => entry.turn);
	}

	private *quiesce(
		context: Context,
		alpha: number,
		beta: number,
		ply: number,
		remaining = 24,
	): Traversal {
		if ((++context.nodes & 63) === 0) yield;
		const state = context.state;
		const result = terminal(state, ply);
		if (result !== null) return { score: result, pv: [] };
		const exact = this.knowledge.tablebase.probe(state);
		if (exact?.proven && !(ply === 0 && context.multiPV))
			return {
				score: exact.wdl * (MATE - ply - exact.distance),
				pv: exact.move ? [exact.move] : [],
			};
		const legal = getLegalTurns(state);
		const moves = legal.filter((turn) => turn.captures.length > 0);
		const stand = evaluate(state) * (state.turn === "dark" ? 1 : -1);
		// Even optional-capture rules do not permit passing when no quiet move exists.
		const compulsory = moves.length > 0 && moves.length === legal.length;
		if (!remaining || !moves.length) return { score: stand, pv: [] };
		let best: NodeResult = { score: compulsory ? -INF : stand, pv: [] };
		if (!compulsory) {
			if (stand >= beta) return best;
			alpha = Math.max(alpha, stand);
		}
		for (const turn of this.order(context, moves, 0, ply)) {
			const undo = makeTurn(state, turn);
			let next: NodeResult;
			try {
				next = yield* this.quiesce(
					context,
					-beta,
					-alpha,
					ply + 1,
					remaining - 1,
				);
			} finally {
				unmakeTurn(state, undo);
			}
			const score = -next.score;
			if (score > best.score) best = { score, pv: [turn, ...next.pv] };
			alpha = Math.max(alpha, score);
			if (alpha >= beta) break;
		}
		return best;
	}

	private *negamax(
		context: Context,
		depth: number,
		alpha: number,
		beta: number,
		ply: number,
	): Traversal {
		if ((++context.nodes & 63) === 0) yield;
		const state = context.state;
		const result = terminal(state, ply);
		if (result !== null) return { score: result, pv: [] };
		const exact = this.knowledge.tablebase.probe(state);
		if (exact?.proven && !(ply === 0 && context.multiPV))
			return {
				score: exact.wdl * (MATE - ply - exact.distance),
				pv: exact.move ? [exact.move] : [],
			};
		if (depth <= 0)
			return context.quiescence
				? yield* this.quiesce(context, alpha, beta, ply)
				: { score: evaluate(state) * (state.turn === "dark" ? 1 : -1), pv: [] };
		const [a, b] = searchKey(state);
		const slot = this.table.find(a, b);
		const moves = getLegalTurns(state);
		if (slot >= 0 && this.table.depths[slot] >= depth && ply > 0) {
			const score = mateFromTable(this.table.scores[slot], ply);
			const bound = this.table.bounds[slot];
			if (
				bound === 1 ||
				(bound === 2 && score >= beta) ||
				(bound === 3 && score <= alpha)
			) {
				const move = moves.find(
					(turn) => turnCode(turn) === this.table.moves[slot],
				);
				return { score, pv: move ? [move] : [] };
			}
		}
		const originalAlpha = alpha;
		let best: NodeResult = { score: -INF, pv: [] };
		const advice = ply === 0 ? this.knowledge.advice(state) : null;
		const ordered = this.order(
			context,
			moves,
			slot >= 0 ? this.table.moves[slot] : advice ? turnCode(advice) : 0,
			ply,
		);
		if (ply === 0) context.rootScores = [];
		for (let index = 0; index < ordered.length; index++) {
			const turn = ordered[index];
			const undo = makeTurn(state, turn);
			let child: NodeResult;
			try {
				// Exact root alternatives are needed to bound lower-level mistakes.
				if (ply === 0 && (context.level !== "expert" || context.multiPV))
					child = yield* this.negamax(context, depth - 1, -INF, INF, ply + 1);
				else if (index === 0)
					child = yield* this.negamax(
						context,
						depth - 1,
						-beta,
						-alpha,
						ply + 1,
					);
				else {
					child = yield* this.negamax(
						context,
						depth - 1,
						-alpha - 1,
						-alpha,
						ply + 1,
					);
					if (-child.score > alpha && -child.score < beta)
						child = yield* this.negamax(
							context,
							depth - 1,
							-beta,
							-alpha,
							ply + 1,
						);
				}
			} finally {
				unmakeTurn(state, undo);
			}
			const score = -child.score;
			const pv = [turn, ...child.pv];
			if (ply === 0) context.rootScores.push({ turn, score, pv });
			if (score > best.score) best = { score, pv };
			alpha = Math.max(alpha, score);
			if (alpha >= beta) {
				if (!turn.captures.length) {
					const code = turnCode(turn);
					context.killers[ply] = [
						code,
						...(context.killers[ply] ?? []).filter((value) => value !== code),
					].slice(0, 2);
					const address = turn.from * 32 + turn.path[turn.path.length - 1];
					context.history[address] = Math.min(
						4000,
						context.history[address] + depth * depth,
					);
				}
				break;
			}
		}
		const bound = best.score <= originalAlpha ? 3 : best.score >= beta ? 2 : 1;
		this.table.save(
			a,
			b,
			depth,
			mateToTable(best.score, ply),
			bound,
			best.pv[0] ? turnCode(best.pv[0]) : 0,
		);
		return best;
	}

	private choose(context: Context, node: NodeResult): NodeResult {
		const tolerance =
			context.level === "beginner" ? 120 : context.level === "casual" ? 35 : 0;
		if (
			!tolerance ||
			!context.rootScores.length ||
			Math.abs(node.score) > MATE - 1000
		)
			return node;
		const choices = context.rootScores
			.filter((entry) => entry.score >= node.score - tolerance)
			.sort((a, b) => b.score - a.score || turnCode(a.turn) - turnCode(b.turn));
		const index = searchKey(context.state)[0] % choices.length;
		return { score: choices[index].score, pv: choices[index].pv };
	}

	/** Cooperative generator slices allow stop/play-now to be serviced during deep DFS. */
	async search(
		state: GameState,
		options: SearchOptions,
	): Promise<SearchInfo | null> {
		const started = performance.now();
		const context = this.context(state, options);
		const control = options.control ?? { cancelled: false, finish: false };
		const sign = state.turn === "dark" ? 1 : -1;
		const terminalScore = terminal(state, 0);
		const fallback =
			terminalScore === null
				? (this.order(context, getLegalTurns(state), 0, 0)[0] ?? null)
				: null;
		let best: SearchInfo = {
			move: fallback,
			score:
				terminalScore === null ? evaluate(state) : terminalScore * sign || 0,
			pv: fallback ? [fallback] : [],
			depth: 0,
			nodes: 0,
			elapsedMs: 0,
		};
		if (terminalScore !== null) return best;
		const budget = Math.max(1, Math.min(options.budgetMs, 24 * 60 * 60 * 1000));
		const deadline = started + budget;
		let lastProgress = started - 251;
		const maximum =
			options.maxDepth ??
			{ beginner: 3, casual: 5, challenging: 14, expert: 64 }[context.level];
		let previous = 0;
		outer: for (let depth = 1; depth <= maximum; depth++) {
			let alpha =
				depth >= 4 && context.level === "expert" && !context.multiPV
					? previous - 40
					: -INF;
			let beta =
				depth >= 4 && context.level === "expert" && !context.multiPV
					? previous + 40
					: INF;
			for (;;) {
				const traversal = this.negamax(context, depth, alpha, beta, 0);
				let next: IteratorResult<void, NodeResult>;
				for (;;) {
					if (
						control.cancelled ||
						control.finish ||
						performance.now() >= deadline
					) {
						traversal.return({ score: 0, pv: [] });
						break outer;
					}
					const sliceEnd = performance.now() + 8;
					do {
						next = traversal.next();
					} while (
						!next.done &&
						performance.now() < sliceEnd &&
						performance.now() < deadline
					);
					if (next.done) break;
					await new Promise<void>((resolve) => setTimeout(resolve, 0));
				}
				const result = next.value;
				if (
					(result.score <= alpha || result.score >= beta) &&
					(alpha !== -INF || beta !== INF)
				) {
					alpha = -INF;
					beta = INF;
					continue;
				}
				previous = result.score;
				const chosen = this.choose(context, result);
				best = {
					...chosen,
					score: chosen.score * sign || 0,
					move: chosen.pv[0] ?? fallback,
					depth,
					nodes: context.nodes,
					elapsedMs: performance.now() - started,
				};
				if (context.multiPV)
					best.alternatives = [...context.rootScores]
						.sort(
							(a, b) =>
								b.score - a.score || turnCode(a.turn) - turnCode(b.turn),
						)
						.slice(0, 3)
						.map((entry) => ({
							move: entry.turn,
							score: entry.score * sign || 0,
							pv: entry.pv,
						}));
				if (performance.now() - lastProgress >= 250) {
					options.onProgress?.(best);
					lastProgress = performance.now();
				}
				if (Math.abs(result.score) >= MATE - 128) break outer;
				break;
			}
			await new Promise<void>((resolve) => setTimeout(resolve, 0));
		}
		if (control.cancelled) return null;
		return {
			...best,
			nodes: context.nodes,
			elapsedMs: performance.now() - started,
		};
	}

	/** Deterministic harness for shallow reference tests and reproducible data generation. */
	fixedDepth(state: GameState, depth: number, quiescence = true): SearchInfo {
		const started = performance.now();
		const context = this.context(state, { budgetMs: Infinity, quiescence });
		const traversal = this.negamax(context, depth, -INF, INF, 0);
		let next = traversal.next();
		while (!next.done) next = traversal.next();
		return {
			...next.value,
			score: next.value.score * (state.turn === "dark" ? 1 : -1) || 0,
			move: next.value.pv[0] ?? null,
			depth,
			nodes: context.nodes,
			elapsedMs: performance.now() - started,
		};
	}
}

/** Plain independent minimax traversal over immutable states for regression comparisons. */
export function referenceSearch(
	state: GameState,
	depth: number,
	ply = 0,
): number {
	const result = terminal(state, ply);
	if (result !== null) return result * (state.turn === "dark" ? 1 : -1);
	if (depth === 0) return evaluate(state);
	const scores = getLegalTurns(state).map((turn) => {
		const child = clone(state);
		makeTurn(child, turn);
		return referenceSearch(child, depth - 1, ply + 1);
	});
	return state.turn === "dark" ? Math.max(...scores) : Math.min(...scores);
}
