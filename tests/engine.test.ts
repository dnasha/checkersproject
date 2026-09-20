import { describe, expect, it } from "vitest";
import {
	applyTurn,
	applyTurnUnchecked,
	createInitialState,
	createState,
	getCoords,
	getLegalTurns,
	getOutcome,
	getSquare,
	isKing,
	makeTurn,
	notation,
	opponent,
	positionKey,
	sameTurn,
	sideOf,
	unmakeTurn,
	type GameState,
	type Side,
	type Turn,
} from "../src/core/engine";

function position(
	pieces: [number, number, number][],
	side: Side = "dark",
	mandatoryCapture = true,
): GameState {
	const board = new Array<number>(32).fill(0);
	for (const [row, col, piece] of pieces) {
		const square = getSquare(row, col);
		if (square < 0) throw new Error("Invalid fixture square");
		board[square] = piece;
	}
	return createState(board, side, { mandatoryCapture });
}

function play(state: GameState, from: number, to: number): GameState {
	const turn = getLegalTurns(state).find(
		(move) => move.from === from && move.path.at(-1) === to,
	);
	if (!turn) throw new Error(`Missing test move ${from}-${to}`);
	return applyTurn(state, turn);
}

describe("coordinates and position creation", () => {
	it("round-trips all 32 dark squares and rejects invalid/light squares", () => {
		for (let square = 0; square < 32; square++)
			expect(getSquare(...getCoords(square))).toBe(square);
		expect(getCoords(0)).toEqual([0, 1]);
		expect(getCoords(31)).toEqual([7, 6]);
		for (const args of [
			[0, 0],
			[8, 1],
			[-1, 0],
			[1, 8],
			[1.5, 0],
		])
			expect(getSquare(args[0], args[1])).toBe(-1);
		expect(getCoords(32)).toEqual([-1, -1]);
	});

	it("starts with twelve pieces per side, dark moving first, and seven choices", () => {
		const state = createInitialState();
		expect(state.board.filter((piece) => piece === 1)).toHaveLength(12);
		expect(state.board.filter((piece) => piece === 3)).toHaveLength(12);
		expect(state.turn).toBe("dark");
		expect(getLegalTurns(state)).toHaveLength(7);
		expect(state.repetitions[positionKey(state)]).toBe(1);
		expect(getOutcome(state)).toBeNull();
	});

	it("copies caller-owned board and rules", () => {
		const board = createInitialState().board;
		const rules = { mandatoryCapture: false };
		const state = createState(board, "light", rules);
		board[0] = 0;
		rules.mandatoryCapture = true;
		expect(state.board[0]).toBe(1);
		expect(state.rules.mandatoryCapture).toBe(false);
	});

	it("rejects malformed boards, invalid side/rules, too many pieces, and uncrowned men", () => {
		expect(() => createState([])).toThrow();
		expect(() => createState(new Array<number>(32))).toThrow();
		expect(() => createState(Array(32).fill(5))).toThrow();
		expect(() => createState(Array(32).fill(0.5))).toThrow();
		expect(() => createState(Array(32).fill(2))).toThrow();
		expect(() => createState(Array(32).fill(0), "red" as Side)).toThrow();
		expect(() =>
			createState(Array(32).fill(0), "dark", {
				mandatoryCapture: "yes",
			} as never),
		).toThrow();
		expect(() => position([[7, 0, 1]])).toThrow();
		expect(() => position([[0, 1, 3]])).toThrow();
	});

	it("distinguishes side to move and rules in position keys", () => {
		const state = createInitialState();
		expect(positionKey(state)).not.toBe(
			positionKey({ ...state, turn: "light" }),
		);
		expect(positionKey(state)).not.toBe(
			positionKey({ ...state, rules: { mandatoryCapture: false } }),
		);
		expect(positionKey(state)).toBe(
			positionKey({ ...state, noProgress: 7 } as GameState),
		);
		expect(sideOf(1)).toBe("dark");
		expect(sideOf(4)).toBe("light");
		expect(sideOf(0)).toBeNull();
		expect(isKing(2)).toBe(true);
		expect(isKing(3)).toBe(false);
		expect(opponent("light")).toBe("dark");
	});
});

describe("complete legal turns", () => {
	it("allows men to move/capture forward only", () => {
		const state = position([
			[4, 3, 1],
			[3, 2, 3],
			[7, 6, 4],
		]);
		expect(
			getLegalTurns(state).every((turn) => turn.captures.length === 0),
		).toBe(true);
		expect(getLegalTurns(state).map((turn) => turn.path[0])).toEqual([
			getSquare(5, 2),
			getSquare(5, 4),
		]);
		const light = position(
			[
				[3, 4, 3],
				[4, 3, 1],
				[0, 1, 2],
			],
			"light",
		);
		expect(
			getLegalTurns(light).every(
				(turn) =>
					turn.captures.length === 0 && getCoords(turn.path[0])[0] === 2,
			),
		).toBe(true);
	});

	it("allows kings to move and capture in either direction", () => {
		const state = position([
			[4, 3, 2],
			[3, 2, 3],
			[7, 6, 4],
		]);
		expect(getLegalTurns(state)).toEqual([
			{
				from: getSquare(4, 3),
				path: [getSquare(2, 1)],
				captures: [getSquare(3, 2)],
				promotion: false,
			},
		]);
		const quiet = position([
			[4, 3, 2],
			[0, 1, 4],
		]);
		expect(getLegalTurns(quiet)).toHaveLength(4);
	});

	it("forces a capture across all pieces, including before move twenty", () => {
		const state = position([
			[1, 2, 1],
			[1, 6, 1],
			[2, 3, 3],
			[7, 6, 4],
		]);
		const moves = getLegalTurns(state);
		expect(moves).toHaveLength(1);
		expect(moves[0].captures).toHaveLength(1);
		expect(moves[0].from).toBe(getSquare(1, 2));
	});

	it("keeps every branch regardless of capture length", () => {
		const state = position([
			[1, 2, 1],
			[2, 1, 3],
			[2, 3, 3],
			[4, 1, 3],
		]);
		const turns = getLegalTurns(state);
		expect(turns.map((turn) => turn.path)).toEqual([
			[getSquare(3, 0), getSquare(5, 2)],
			[getSquare(3, 4)],
		]);
		expect(turns.map((turn) => turn.captures.length)).toEqual([2, 1]);
	});

	it("cannot stop early or switch pieces during a multi-jump", () => {
		const state = position([
			[1, 2, 1],
			[1, 6, 1],
			[2, 1, 3],
			[2, 5, 3],
			[4, 1, 3],
		]);
		const full = getLegalTurns(state).find(
			(turn) => turn.from === getSquare(1, 2),
		)!;
		expect(full.path).toEqual([getSquare(3, 0), getSquare(5, 2)]);
		expect(() =>
			applyTurn(state, {
				...full,
				path: full.path.slice(0, 1),
				captures: full.captures.slice(0, 1),
			}),
		).toThrow();
		expect(() =>
			applyTurn(state, { ...full, path: [getSquare(3, 0), getSquare(3, 4)] }),
		).toThrow();
		const next = applyTurn(state, full);
		expect(next.board[getSquare(1, 6)]).toBe(1);
		expect(next.board[getSquare(2, 5)]).toBe(3);
		expect(next.ply).toBe(1);
		expect(next.turn).toBe("light");
	});

	it("optional capture permits quiet turns but never partial capture chains", () => {
		const state = position(
			[
				[1, 2, 1],
				[1, 6, 1],
				[2, 1, 3],
				[4, 1, 3],
			],
			"dark",
			false,
		);
		const turns = getLegalTurns(state);
		expect(turns.some((turn) => turn.captures.length === 0)).toBe(true);
		const capture = turns.find((turn) => turn.captures.length)!;
		expect(capture.captures).toHaveLength(2);
		expect(() =>
			applyTurn(state, {
				...capture,
				path: capture.path.slice(0, 1),
				captures: capture.captures.slice(0, 1),
			}),
		).toThrow();
	});

	it("promotion ends a capture even if a king could capture backward", () => {
		const dark = position([
			[5, 0, 1],
			[6, 1, 3],
			[6, 3, 3],
		]);
		const turn = getLegalTurns(dark)[0];
		expect(turn.path).toEqual([getSquare(7, 2)]);
		expect(turn.promotion).toBe(true);
		const next = applyTurn(dark, turn);
		expect(next.board[getSquare(7, 2)]).toBe(2);
		expect(next.board[getSquare(6, 3)]).toBe(3);
		const light = position(
			[
				[2, 7, 3],
				[1, 6, 1],
				[1, 4, 1],
			],
			"light",
		);
		const lightTurn = getLegalTurns(light)[0];
		expect(lightTurn.path).toEqual([getSquare(0, 5)]);
		expect(applyTurn(light, lightTurn).board[getSquare(0, 5)]).toBe(4);
	});

	it("crowns quiet moves and renders complete standard square notation", () => {
		const state = position([
			[6, 1, 1],
			[0, 1, 4],
		]);
		const move = getLegalTurns(state)[0];
		expect(move.promotion).toBe(true);
		expect(applyTurn(state, move).board[move.path[0]]).toBe(2);
		expect(
			notation({
				from: 4,
				path: [13, 22],
				captures: [9, 18],
				promotion: false,
			}),
		).toBe("5x14x23");
		expect(
			notation({ from: 8, path: [12], captures: [], promotion: false }),
		).toBe("9-13");
		expect(sameTurn(move, { ...move, promotion: false })).toBe(false);
	});

	it("supports king capture circuits returning to their starting square", () => {
		const state = position([
			[2, 3, 2],
			[3, 4, 3],
			[5, 4, 3],
			[5, 2, 3],
			[3, 2, 3],
		]);
		const turns = getLegalTurns(state);
		expect(turns).toHaveLength(2);
		for (const turn of turns) {
			expect(turn.path).toHaveLength(4);
			expect(turn.path.at(-1)).toBe(turn.from);
			const next = applyTurn(state, turn);
			expect(next.board[turn.from]).toBe(2);
			expect(next.board.filter(Boolean)).toHaveLength(1);
			expect(getOutcome(next)).toEqual({ winner: "dark", reason: "capture" });
		}
	});

	it("never mutates positions while generating or applying legal turns", () => {
		const state = position([
			[1, 2, 1],
			[2, 1, 3],
			[2, 3, 3],
			[4, 1, 3],
		]);
		const before = structuredClone(state);
		const turns = getLegalTurns(state);
		for (const turn of turns) applyTurn(state, turn);
		expect(state).toEqual(before);
	});

	it("rejects forged captures, promotion flags, incomplete and malformed moves", () => {
		const state = createInitialState();
		const turn = getLegalTurns(state)[0];
		for (const invalid of [
			{ ...turn, captures: [20] },
			{ ...turn, promotion: true },
			{ ...turn, from: 20 },
			{ ...turn, path: [] },
			null,
		]) {
			expect(() => applyTurn(state, invalid as Turn)).toThrow();
		}
	});
});

describe("terminal states and draws", () => {
	it("recognizes elimination and blocked-player losses immediately for the moving side", () => {
		expect(getOutcome(position([[2, 1, 1]], "light"))).toEqual({
			winner: "dark",
			reason: "capture",
		});
		const blocked = position(
			[
				[6, 1, 1],
				[7, 0, 4],
				[7, 2, 4],
			],
			"dark",
		);
		expect(getOutcome(blocked)).toEqual({ winner: "light", reason: "blocked" });
		expect(getOutcome({ ...blocked, turn: "light" })).toBeNull();
		expect(blocked.ply).toBe(0);
	});

	it("declares repetition only on the third occurrence with the same moving side", () => {
		let state = position([
			[0, 1, 2],
			[7, 6, 4],
		]);
		const cycle = [
			[0, 4],
			[31, 27],
			[4, 0],
			[27, 31],
		];
		for (const [from, to] of cycle) state = play(state, from, to);
		expect(state.repetitions[positionKey(state)]).toBe(2);
		expect(getOutcome(state)).toBeNull();
		for (const [from, to] of cycle) state = play(state, from, to);
		expect(getOutcome(state)).toEqual({ winner: null, reason: "repetition" });
		expect(() => applyTurn(state, getLegalTurns(state)[0])).toThrow(
			"already ended",
		);
	});

	it("draws at exactly 80 quiet king turns and rejects further play", () => {
		const state = position([
			[0, 1, 2],
			[7, 6, 4],
		]);
		state.noProgress = 79;
		expect(getOutcome(state)).toBeNull();
		const next = applyTurn(state, getLegalTurns(state)[0]);
		expect(next.noProgress).toBe(80);
		expect(getOutcome(next)).toEqual({ winner: null, reason: "no-progress" });
		expect(() => applyTurn(next, getLegalTurns(next)[0])).toThrow();
	});

	it("resets no-progress/relevant repetitions on a man move or capture, once per turn", () => {
		const man = position([
			[1, 2, 1],
			[7, 6, 4],
		]);
		man.noProgress = 79;
		man.repetitions.old = 2;
		const moved = applyTurn(man, getLegalTurns(man)[0]);
		expect(moved.noProgress).toBe(0);
		expect(Object.keys(moved.repetitions)).toHaveLength(1);
		const king = position([
			[1, 2, 2],
			[2, 1, 3],
			[4, 1, 3],
			[7, 6, 4],
		]);
		king.noProgress = 79;
		const captured = applyTurn(king, getLegalTurns(king)[0]);
		expect(captured.noProgress).toBe(0);
		expect(captured.ply).toBe(1);
		expect(Object.values(captured.repetitions)).toEqual([1]);
	});

	it("prioritizes wins over automatic draws", () => {
		const state = position([
			[6, 1, 1],
			[7, 0, 4],
			[7, 2, 4],
		]);
		state.noProgress = 80;
		state.repetitions[positionKey(state)] = 3;
		expect(getOutcome(state)).toEqual({ winner: "light", reason: "blocked" });
	});
});

describe("search make/unmake contract", () => {
	it("matches immutable application and restores board, counters, repetition history, and references", () => {
		const fixtures = [
			createInitialState(),
			position([
				[0, 1, 2],
				[7, 6, 4],
			]),
			position([
				[5, 0, 1],
				[6, 1, 3],
				[6, 3, 3],
			]),
			position([
				[2, 3, 2],
				[3, 4, 3],
				[5, 4, 3],
				[5, 2, 3],
				[3, 2, 3],
			]),
		];
		for (const state of fixtures) {
			const before = structuredClone(state);
			const boardReference = state.board;
			const historyReference = state.repetitions;
			for (const turn of getLegalTurns(state)) {
				const expected = applyTurnUnchecked(state, turn);
				const undo = makeTurn(state, turn);
				expect(state).toEqual(expected);
				unmakeTurn(state, undo);
				expect(state).toEqual(before);
				expect(state.board).toBe(boardReference);
				expect(state.repetitions).toBe(historyReference);
			}
		}
	});

	it("round-trips nested search including reversible and irreversible branches", () => {
		const root = createInitialState();
		const before = structuredClone(root);
		const visit = (state: GameState, depth: number): number => {
			if (!depth) return 1;
			let count = 0;
			for (const turn of getLegalTurns(state)) {
				const snapshot = structuredClone(state);
				const undo = makeTurn(state, turn);
				count += visit(state, depth - 1);
				unmakeTurn(state, undo);
				expect(state).toEqual(snapshot);
			}
			return count;
		};
		expect(visit(root, 3)).toBe(302);
		expect(root).toEqual(before);
	});
});
