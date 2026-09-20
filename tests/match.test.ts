import { describe, expect, it } from "vitest";
import {
	createState,
	getLegalTurns,
	getSquare,
	type GameState,
} from "../src/core/engine";
import {
	newMatch,
	commitTurn,
	settleClock,
	pauseMatch,
	resumeMatch,
	canUndo,
	undoMatch,
	validateMatch,
	type MatchConfig,
} from "../src/core/match";

const config: MatchConfig = {
	mode: "practice",
	difficulty: "casual",
	humanSide: "dark",
	mandatoryCapture: true,
	timeControl: "off",
};
function chain(): GameState {
	const board = Array(32).fill(0);
	board[getSquare(1, 0)] = 1;
	board[getSquare(2, 1)] = 3;
	board[getSquare(4, 3)] = 3;
	board[getSquare(7, 6)] = 4;
	return createState(board);
}
describe("match lifecycle and clocks", () => {
	it("charges elapsed time once, then increments once per complete turn", () => {
		const game = newMatch({ ...config, timeControl: "3+3" }, chain(), 1000);
		const move = getLegalTurns(game.state)[0];
		expect(move.captures).toHaveLength(2);
		const moved = commitTurn(game, move, 3500);
		expect(moved.clock.remaining.dark).toBe(180500);
		expect(moved.history).toHaveLength(1);
		const later = settleClock(moved, 5000);
		expect(later.clock.remaining.dark).toBe(180500);
		expect(later.clock.remaining.light).toBe(178500);
		expect(settleClock(later, 5000)).toBe(later);
	});
	it("expires before accepting a move and cannot run negative", () => {
		const game = newMatch({ ...config, timeControl: "3+3" }, undefined, 0);
		const moved = commitTurn(game, getLegalTurns(game.state)[0], 200000);
		expect(moved.outcome).toEqual({ winner: "light", reason: "timeout" });
		expect(moved.history).toHaveLength(0);
		expect(moved.clock.remaining.dark).toBe(0);
	});
	it("settles hidden/closed elapsed time, but explicit pause freezes it", () => {
		const game = newMatch({ ...config, timeControl: "3+3" }, undefined, 0);
		const restored = validateMatch(JSON.parse(JSON.stringify(game)));
		expect(settleClock(restored, 10000).clock.remaining.dark).toBe(170000);
		const paused = pauseMatch(restored, 10000);
		expect(settleClock(paused, 90000).clock.remaining.dark).toBe(170000);
		const resumed = resumeMatch(paused, 90000);
		expect(settleClock(resumed, 92000).clock.remaining.dark).toBe(168000);
		expect(() => commitTurn(paused, getLegalTurns(paused.state)[0])).toThrow(
			"Resume",
		);
	});
	it("restores a partial capture without adding a turn or increment", () => {
		let game = newMatch(config, chain(), 0);
		const turn = getLegalTurns(game.state)[0];
		game = { ...game, pending: { from: turn.from, path: [turn.path[0]] } };
		const restored = validateMatch(JSON.parse(JSON.stringify(game)));
		expect(restored.pending).toEqual(game.pending);
		expect(restored.history).toHaveLength(0);
		expect(commitTurn(restored, turn, 1).history).toHaveLength(1);
		expect(undoMatch(restored, 1).pending).toBeNull();
	});
	it("undo returns to the previous human decision and fresh games have no stale capture", () => {
		let game = newMatch(config, undefined, 0);
		for (let i = 0; i < 2; i++)
			game = commitTurn(game, getLegalTurns(game.state)[0], i + 1);
		const undone = undoMatch(game, 3);
		expect(undone.history).toHaveLength(0);
		expect(undone.state).toEqual(undone.initial);
		expect(newMatch(config).pending).toBeNull();
		const timed = newMatch({ ...config, timeControl: "3+3" });
		expect(() => undoMatch(timed)).toThrow();
	});
	it("rejects illegal imported history and reconstructs derived fields", () => {
		const game = newMatch(config, undefined, 0);
		const moved = commitTurn(game, getLegalTurns(game.state)[0], 1);
		const damaged = structuredClone(moved);
		damaged.state.board.fill(0);
		expect(validateMatch(damaged).state).toEqual(moved.state);
		damaged.history[0].turn.path = [0];
		expect(() => validateMatch(damaged)).toThrow("Illegal move");
	});
	it("validates unfinished capture prefixes and unsupported records", () => {
		const game = newMatch(config, chain(), 0);
		expect(() =>
			validateMatch({ ...game, pending: { from: 0, path: [31] } }),
		).toThrow("unfinished");
		expect(() => validateMatch({ ...game, version: 99 })).toThrow("version");
	});
	it("repeated resume events do not discard time from a running clock", () => {
		const game = newMatch({ ...config, timeControl: "3+3" }, undefined, 0);
		const resumed = resumeMatch(game, 1000);
		expect(resumed.clock.remaining.dark).toBe(179000);
		expect(resumeMatch(resumed, 2500).clock.remaining.dark).toBe(177500);
	});
	it("an imported zero clock expires even when no time has passed since its anchor", () => {
		const game = newMatch({ ...config, timeControl: "3+3" }, undefined, 1000);
		game.clock.remaining.dark = 0;
		const restored = validateMatch(game);
		const result = commitTurn(restored, getLegalTurns(restored.state)[0], 1000);
		expect(result.outcome).toEqual({ winner: "light", reason: "timeout" });
		expect(result.history).toHaveLength(0);
	});
	it("preserves a timed partial jump through pause, reload, and one final increment", () => {
		let game = newMatch({ ...config, timeControl: "3+3" }, chain(), 0);
		const turn = getLegalTurns(game.state)[0];
		game = { ...game, pending: { from: turn.from, path: [turn.path[0]] } };
		const paused = pauseMatch(game, 1500);
		const loaded = validateMatch(JSON.parse(JSON.stringify(paused)));
		expect(loaded.pending).toEqual(game.pending);
		expect(() => undoMatch(loaded, 90000)).toThrow("untimed");
		const resumed = resumeMatch(loaded, 90000);
		const finished = commitTurn(resumed, turn, 91000);
		expect(finished.history).toHaveLength(1);
		expect(finished.clock.remaining.dark).toBe(180500);
		expect(finished.pending).toBeNull();
	});
	it("playing light cannot undo an AI opening before making a human decision", () => {
		let game = newMatch({ ...config, humanSide: "light" }, undefined, 0);
		game = commitTurn(game, getLegalTurns(game.state)[0], 1);
		expect(canUndo(game)).toBe(false);
		expect(() => undoMatch(game, 2)).toThrow();
		const opening = game.state;
		game = commitTurn(game, getLegalTurns(game.state)[0], 3);
		game = commitTurn(game, getLegalTurns(game.state)[0], 4);
		const undone = undoMatch(pauseMatch(game, 5), 6);
		expect(undone.history).toHaveLength(1);
		expect(undone.state).toEqual(opening);
		expect(undone.clock.paused).toBe(true);
	});
	it("rejects structurally broken imported turns with a useful validation error", () => {
		const game = newMatch(config, undefined, 0);
		for (const entry of [
			null,
			{},
			{ turn: {} },
			{ turn: { from: 9, path: null, captures: [] } },
		]) {
			expect(() => validateMatch({ ...game, history: [entry] })).toThrow(
				"Illegal move at turn 1",
			);
		}
		expect(() =>
			validateMatch({ ...game, initial: { ...game.initial, turn: undefined } }),
		).toThrow("record");
	});
});
