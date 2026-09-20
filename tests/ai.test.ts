import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
	applyTurn,
	applyTurnUnchecked,
	createInitialState,
	createState,
	getLegalTurns,
	getOutcome,
	getSquare,
	positionKey,
	type GameState,
	type Turn,
} from "../src/core/engine";
import { evaluate } from "../src/ai/evaluate";
import { Knowledge, type KnowledgeFile } from "../src/ai/knowledge";
import {
	searchBudget,
	type SearchRequest,
	type WorkerResult,
} from "../src/ai/protocol";
import {
	MATE,
	referenceSearch,
	SearchEngine,
	searchKey,
} from "../src/ai/search";
import { WorkerController } from "../src/ai/worker-controller";
import {
	TwoPieceTablebase,
	twoPieceIndex,
	type TwoPieceFile,
} from "../src/ai/tablebase";

function position(
	pieces: [number, number, number][],
	turn: "dark" | "light" = "dark",
): GameState {
	const board = Array<number>(32).fill(0);
	for (const [row, col, piece] of pieces) board[getSquare(row, col)] = piece;
	return createState(board, turn);
}
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
function request(
	id: number,
	purpose: SearchRequest["purpose"] = "move",
): SearchRequest {
	return {
		type: "search",
		id,
		sessionId: "fixture",
		revision: id,
		purpose,
		state: createInitialState(),
		budgetMs: 5000,
		level: "expert",
	};
}
function isLegal(state: GameState, move: Turn | null): boolean {
	return (
		move !== null &&
		getLegalTurns(state).some(
			(turn) => JSON.stringify(turn) === JSON.stringify(move),
		)
	);
}
function decodeTwoPiece(encoded: number): GameState {
	let index = encoded;
	const mandatoryCapture = index % 2 === 0;
	index >>= 1;
	const turn = index % 2 === 0 ? "dark" : "light";
	index >>= 1;
	const lightPiece = index % 2 === 0 ? 3 : 4;
	index >>= 1;
	const darkPiece = index % 2 === 0 ? 1 : 2;
	index >>= 1;
	const light = index % 32;
	const dark = Math.floor(index / 32);
	const board = Array<number>(32).fill(0);
	board[dark] = darkPiece;
	board[light] = lightPiece;
	return createState(board, turn, { mandatoryCapture });
}

describe("search correctness", () => {
	it("agrees with independent shallow minimax on opening and both colors", () => {
		let state = createInitialState();
		for (let ply = 0; ply < 8; ply++) {
			const engine = new SearchEngine();
			expect(engine.fixedDepth(state, 3, false).score).toBe(
				referenceSearch(state, 3),
			);
			const moves = getLegalTurns(state);
			state = applyTurn(state, moves[(ply * 7 + 3) % moves.length]);
		}
	});

	it("does not mix transpositions between quiescence and the reference harness", () => {
		const state = createInitialState();
		const engine = new SearchEngine();
		engine.fixedDepth(state, 3, true);
		expect(engine.fixedDepth(state, 3, false).score).toBe(
			referenceSearch(state, 3),
		);
		expect(engine.fixedDepth(state, 3, true).score).toBe(
			new SearchEngine().fixedDepth(state, 3, true).score,
		);
	});

	it("searches complete capture chains and returns a forced elimination", () => {
		const state = position([
			[2, 1, 1],
			[3, 2, 3],
			[5, 4, 3],
		]);
		const original = JSON.stringify(state);
		const result = new SearchEngine().fixedDepth(state, 2);
		expect(result.move?.captures).toHaveLength(2);
		expect(result.score).toBeGreaterThan(MATE - 10);
		expect(getOutcome(applyTurn(state, result.move!))?.winner).toBe("dark");
		expect(JSON.stringify(state)).toBe(original);
	});

	it("uses Dark-positive scores for Light forced wins too", () => {
		const state = position(
			[
				[5, 4, 3],
				[4, 3, 1],
			],
			"light",
		);
		const result = new SearchEngine().fixedDepth(state, 2);
		expect(result.score).toBeLessThan(-MATE + 10);
		expect(result.move?.captures).toHaveLength(1);
	});

	it("finishes mandatory captures at the horizon", () => {
		const state = position([
			[2, 1, 1],
			[3, 2, 3],
		]);
		const result = new SearchEngine().fixedDepth(state, 0, true);
		expect(result.score).toBeGreaterThan(MATE - 10);
		expect(result.move?.captures).toHaveLength(1);
	});

	it("does not stand pat in optional mode when capturing is the only legal move", () => {
		const state = createState(
			[
				2, 0, 0, 0, 3, 3, 0, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 3, 0, 0, 0, 0, 0,
				0, 0, 0, 0, 0, 0, 0, 0,
			],
			"dark",
			{ mandatoryCapture: false },
		);
		expect(getLegalTurns(state)).toHaveLength(1);
		expect(new SearchEngine().fixedDepth(state, 0, true).score).toBe(-MATE + 2);
	});

	it("does not reuse cached scores across no-progress or repetition contexts", () => {
		const state = position([
			[1, 0, 2],
			[1, 4, 2],
			[6, 7, 4],
		]);
		const engine = new SearchEngine();
		const score = engine.fixedDepth(state, 2, false).score;
		expect(score).toBeGreaterThan(80);
		const almostDraw = structuredClone(state);
		almostDraw.noProgress = 79;
		expect(engine.fixedDepth(almostDraw, 2, false).score).toBe(0);
		const repeats = structuredClone(state);
		for (const move of getLegalTurns(state))
			repeats.repetitions[positionKey(applyTurn(state, move))] = 2;
		expect(engine.fixedDepth(repeats, 2, false).score).toBe(0);
		expect(searchKey(state)).not.toEqual(searchKey(almostDraw));
		expect(searchKey(state)).not.toEqual(searchKey(repeats));
		const optional = { ...state, rules: { mandatoryCapture: false } };
		expect(searchKey(state)).not.toEqual(searchKey(optional));
	});

	it("respects terminal draws and never recommends playing past them", async () => {
		const state = position([
			[1, 0, 2],
			[6, 7, 4],
		]);
		state.repetitions[positionKey(state)] = 3;
		const result = await new SearchEngine().search(state, { budgetMs: 10 });
		expect(result?.move).toBeNull();
		expect(result?.score).toBe(0);
	});

	it("keeps typed transposition storage below 32 MiB", () => {
		expect(new SearchEngine().cacheBytes).toBeLessThanOrEqual(32 * 1024 * 1024);
	});

	it("keeps evaluation finite and balanced at the initial position", () => {
		expect(evaluate(createInitialState())).toBe(0);
	});

	it("returns legal moves within small budgets at all four levels", async () => {
		const state = createInitialState();
		for (const level of [
			"beginner",
			"casual",
			"challenging",
			"expert",
		] as const) {
			const result = await new SearchEngine().search(state, {
				budgetMs: 30,
				level,
			});
			expect(isLegal(state, result!.move)).toBe(true);
			expect(result!.elapsedMs).toBeLessThan(500);
		}
	});

	it("returns exact top-three analysis alternatives from a completed depth", async () => {
		for (const state of [
			createInitialState(),
			applyTurn(createInitialState(), getLegalTurns(createInitialState())[0]),
		]) {
			const result = (await new SearchEngine().search(state, {
				budgetMs: 1000,
				maxDepth: 2,
				quiescence: false,
				multiPV: true,
			}))!;
			expect(result.depth).toBe(2);
			expect(result.alternatives).toHaveLength(3);
			const expected = getLegalTurns(state)
				.map((move) => referenceSearch(applyTurn(state, move), 1, 1))
				.sort((a, b) => (state.turn === "dark" ? b - a : a - b))
				.slice(0, 3);
			expect(
				result.alternatives!.map((alternative) => alternative.score),
			).toEqual(expected);
			for (const alternative of result.alternatives!) {
				expect(isLegal(state, alternative.move)).toBe(true);
				expect(alternative.score).toBe(
					referenceSearch(applyTurn(state, alternative.move), 1, 1),
				);
				let replay = state;
				for (const turn of alternative.pv) replay = applyTurn(replay, turn);
			}
		}
	});
});

describe("worker scheduling and cancellation", () => {
	it("cancels a deep ponder without publishing stale results", async () => {
		const responses: WorkerResult[] = [];
		const worker = new WorkerController((message) => responses.push(message));
		worker.handle(request(1, "ponder"));
		worker.handle({ type: "stop" });
		await pause(30);
		expect(
			responses.filter((message) => message.type === "result"),
		).toHaveLength(0);
	});

	it("replaces pondering with a move and preserves request identity", async () => {
		const responses: WorkerResult[] = [];
		const worker = new WorkerController((message) => responses.push(message));
		worker.handle(request(1, "ponder"));
		worker.handle({ ...request(2), budgetMs: 30 });
		await pause(150);
		const results = responses.filter((message) => message.type === "result");
		expect(results).toHaveLength(1);
		expect(results[0]).toMatchObject({
			id: 2,
			revision: 2,
			sessionId: "fixture",
			purpose: "move",
		});
		expect(isLegal(createInitialState(), results[0].move)).toBe(true);
	});

	it("play-now returns the most recent completed iteration promptly", async () => {
		const responses: WorkerResult[] = [];
		const worker = new WorkerController((message) => responses.push(message));
		worker.handle(request(1));
		worker.handle({ type: "play-now" });
		await pause(100);
		const result = responses.find((message) => message.type === "result");
		expect(result).toBeDefined();
		expect(isLegal(createInitialState(), result!.move)).toBe(true);
	});

	it("prevents analysis or ponder from interrupting a move search", async () => {
		const responses: WorkerResult[] = [];
		const worker = new WorkerController((message) => responses.push(message));
		worker.handle(request(1));
		worker.handle(request(2, "analysis"));
		worker.handle(request(3, "ponder"));
		worker.handle({ type: "play-now" });
		await pause(100);
		expect(
			responses
				.filter((message) => message.type === "error")
				.map((message) => message.id),
		).toEqual([2, 3]);
		expect(responses.find((message) => message.type === "result")?.id).toBe(1);
	});

	it("reports a search failure with a legal recovery move", async () => {
		const responses: WorkerResult[] = [];
		const worker = new WorkerController((message) => responses.push(message));
		worker.engine.search = async () => {
			throw new Error("Fixture worker failure");
		};
		worker.handle(request(1));
		await pause(0);
		expect(responses[0]).toMatchObject({
			type: "error",
			id: 1,
			message: "Fixture worker failure",
		});
		expect(isLegal(createInitialState(), responses[0].move)).toBe(true);
	});
});

describe("search guidance and budgets", () => {
	it("contains every legal two-piece position and satisfies all retrograde equations", () => {
		const raw = readFileSync("public/data/two-piece.json", "utf8");
		expect(Buffer.byteLength(raw)).toBeLessThan(2 * 1024 * 1024);
		const file = JSON.parse(raw) as TwoPieceFile;
		const entries = new Map(file.entries.map((entry) => [entry[0], entry]));
		expect(entries.size).toBe(13952);
		const table = new TwoPieceTablebase();
		table.install(file);
		for (const [index, wdl, distance, to] of file.entries) {
			const state = decodeTwoPiece(index);
			expect(twoPieceIndex(state)).toBe(index);
			const moves = getLegalTurns(state);
			if (!moves.length) {
				expect([wdl, distance, to]).toEqual([-1, 0, -1]);
				continue;
			}
			const recommendation = moves.find(
				(move) => move.path[move.path.length - 1] === to,
			);
			expect(recommendation).toBeDefined();
			if (moves.some((move) => move.captures.length > 0)) {
				expect([wdl, distance]).toEqual([1, 1]);
				expect(recommendation!.captures).toHaveLength(1);
				continue;
			}
			const children = moves.map(
				(move) => entries.get(twoPieceIndex(applyTurnUnchecked(state, move))!)!,
			);
			const advised = entries.get(
				twoPieceIndex(applyTurnUnchecked(state, recommendation!))!,
			)!;
			if (wdl === 1) {
				const losses = children.filter((child) => child[1] === -1);
				expect(losses.length).toBeGreaterThan(0);
				expect(distance).toBe(1 + Math.min(...losses.map((child) => child[2])));
				expect([advised[1], advised[2]]).toEqual([-1, distance - 1]);
			} else if (wdl === -1) {
				expect(children.every((child) => child[1] === 1)).toBe(true);
				expect(distance).toBe(
					1 + Math.max(...children.map((child) => child[2])),
				);
				expect([advised[1], advised[2]]).toEqual([1, distance - 1]);
			} else {
				expect(wdl).toBe(0);
				expect(children.some((child) => child[1] === 0)).toBe(true);
				expect(children.some((child) => child[1] === -1)).toBe(false);
				expect(advised[1]).toBe(0);
			}
		}
	});

	it("proves two-piece results only when live draw history permits the DTM strategy", () => {
		const file = JSON.parse(
			readFileSync("public/data/two-piece.json", "utf8"),
		) as TwoPieceFile;
		const entry = file.entries.find(
			(entry) => entry[1] === 1 && entry[2] >= 5,
		)!;
		const state = decodeTwoPiece(entry[0]);
		const table = new TwoPieceTablebase();
		table.install(file);
		expect(table.probe(state)).toMatchObject({
			wdl: 1,
			distance: entry[2],
			proven: true,
		});
		const repeated = structuredClone(state);
		repeated.repetitions[positionKey(repeated)] = 2;
		expect(table.probe(repeated)?.proven).toBe(false);
		const late = structuredClone(state);
		late.noProgress = 80 - entry[2];
		expect(table.probe(late)?.proven).toBe(false);
		const engine = new SearchEngine();
		engine.knowledge.tablebase.install(file);
		const result = engine.fixedDepth(state, 1);
		expect(result.score).toBe(
			(state.turn === "dark" ? 1 : -1) * (MATE - entry[2]),
		);
		let current = state;
		for (let distance = entry[2]; distance > 0; distance--) {
			const probe = table.probe(current)!;
			expect(probe.distance).toBe(distance);
			current = applyTurn(current, probe.move!);
		}
		expect(getOutcome(current)?.winner).toBe(state.turn);
	});

	it("ships bounded, original datasets containing only legal advice", () => {
		for (const kind of ["opening", "endgame"] as const) {
			const raw = readFileSync(`public/data/${kind}.json`, "utf8");
			expect(Buffer.byteLength(raw)).toBeLessThan(2 * 1024 * 1024);
			const file = JSON.parse(raw) as KnowledgeFile;
			expect(file.version).toBe(1);
			expect(file.kind).toBe(kind);
			expect(file.entries.length).toBeGreaterThan(0);
			if (kind === "opening")
				expect(file.entries.length).toBeLessThanOrEqual(256);
			expect(new Set(file.entries.map((entry) => entry.key)).size).toBe(
				file.entries.length,
			);
			const knowledge = new Knowledge();
			knowledge.install(file);
			for (const entry of file.entries) {
				const [encoded, turn, rule] = entry.key.split(":");
				const board = Array.from(encoded, Number);
				const state = createState(board, turn === "d" ? "dark" : "light", {
					mandatoryCapture: rule === "m",
				});
				if (kind === "endgame")
					expect(board.filter(Boolean).length).toBeLessThanOrEqual(3);
				expect(isLegal(state, knowledge.advice(state))).toBe(true);
				expect(Number.isFinite(entry.score)).toBe(true);
			}
		}
	});

	it("uses generated advice only when it matches a legal move", () => {
		const state = createInitialState();
		const move = getLegalTurns(state)[0];
		const knowledge = new Knowledge();
		knowledge.install({
			version: 1,
			kind: "opening",
			description: "test",
			entries: [
				{
					key: positionKey(state),
					from: move.from,
					path: move.path,
					score: 9999,
					depth: 1,
				},
			],
		});
		expect(knowledge.advice(state)).toEqual(move);
		knowledge.install({
			version: 1,
			kind: "opening",
			description: "test",
			entries: [
				{ key: positionKey(state), from: 0, path: [31], score: 9999, depth: 1 },
			],
		});
		expect(knowledge.advice(state)).toBeNull();
	});

	it("shrinks timed budgets and permits ten-second untimed Expert", () => {
		expect(searchBudget("expert")).toBe(10000);
		expect(searchBudget("expert", 180000)).toBe(2000);
		expect(searchBudget("expert", 2400)).toBe(100);
		expect(searchBudget("expert", 90)).toBe(5);
	});
});
