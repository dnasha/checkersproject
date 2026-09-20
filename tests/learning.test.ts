import { describe, expect, it } from "vitest";
import { lessons, puzzles, type LearningGoal } from "../src/content/learning";
import {
	applyTurn,
	getLegalTurns,
	getOutcome,
	isKing,
	positionKey,
	sameTurn,
	type GameState,
	type Turn,
} from "../src/core/engine";

function verifyGoal(
	initial: GameState,
	turns: Turn[],
	goal: LearningGoal,
): void {
	const original = structuredClone(initial);
	let state = initial;
	let captured = 0;
	let promoted = false;
	for (const turn of turns) {
		expect(getOutcome(state)).toBeNull();
		expect(getLegalTurns(state).some((legal) => sameTurn(legal, turn))).toBe(
			true,
		);
		const countBefore = state.board.filter(Boolean).length;
		state = applyTurn(state, turn);
		captured += turn.captures.length;
		promoted ||= turn.promotion;
		expect(state.board.filter(Boolean).length).toBe(
			countBefore - turn.captures.length,
		);
	}
	expect(initial).toEqual(original);
	expect(turns.length).toBeGreaterThan(0);
	if (goal.captures !== undefined) expect(captured).toBe(goal.captures);
	if (goal.promotes) {
		expect(promoted).toBe(true);
		expect(isKing(state.board[turns.at(-1)!.path.at(-1)!])).toBe(true);
	}
	if (goal.destination !== undefined)
		expect(turns.at(-1)!.path.at(-1)).toBe(goal.destination);
	if (goal.outcome) expect(getOutcome(state)).toEqual(goal.outcome);
	if (goal.safe) {
		expect(getOutcome(state)).toBeNull();
		expect(
			getLegalTurns(state).every((reply) => reply.captures.length === 0),
		).toBe(true);
	}
}

describe("authored interactive lessons", () => {
	it("covers all six promised topics", () => {
		expect(lessons.map((lesson) => lesson.id)).toEqual([
			"movement",
			"captures",
			"compulsory",
			"kings",
			"tactics",
			"endings",
		]);
	});
	for (const lesson of lessons)
		it(`${lesson.title} has a legal solution that teaches its stated goal`, () => {
			verifyGoal(lesson.state, lesson.solution, lesson.goal);
			expect(lesson.description.length).toBeGreaterThan(20);
			expect(lesson.instruction.length).toBeGreaterThan(20);
			expect(lesson.explanation.length).toBeGreaterThan(20);
		});
});

describe("original puzzle collection", () => {
	it("contains 24 distinct positions and IDs, with six puzzles in each category", () => {
		expect(puzzles).toHaveLength(24);
		expect(new Set(puzzles.map((puzzle) => puzzle.id)).size).toBe(24);
		expect(
			new Set(puzzles.map((puzzle) => positionKey(puzzle.state))).size,
		).toBe(24);
		for (const category of ["captures", "kings", "promotion", "tactics"])
			expect(
				puzzles.filter((puzzle) => puzzle.category === category),
			).toHaveLength(6);
		expect(new Set(puzzles.map((puzzle) => puzzle.difficulty))).toEqual(
			new Set(["beginner", "intermediate", "advanced"]),
		);
	});
	for (const puzzle of puzzles)
		it(`${puzzle.title}: primary and alternative solutions fulfill the observable goal`, () => {
			for (const route of [puzzle.solution, ...(puzzle.alternatives ?? [])])
				verifyGoal(puzzle.state, route, puzzle.goal);
			expect(puzzle.hint.length).toBeGreaterThan(20);
			expect(puzzle.explanation.length).toBeGreaterThan(20);
			expect(puzzle.state.rules.mandatoryCapture).toBe(true);
		});

	it("offers genuinely different capture counts at the authored forks", () => {
		for (const id of ["capture-04", "tactics-02", "tactics-03"]) {
			const puzzle = puzzles.find((item) => item.id === id)!;
			const choices = new Set(
				getLegalTurns(puzzle.state).map((turn) => turn.captures.length),
			);
			expect(choices.size).toBeGreaterThan(1);
			expect(puzzle.solution[0].captures.length).toBe(Math.max(...choices));
		}
	});

	it("the defensive puzzle rejects the landing that permits immediate elimination", () => {
		const puzzle = puzzles.find((item) => item.id === "tactics-06")!;
		const unsafe = getLegalTurns(puzzle.state).find(
			(turn) => !sameTurn(turn, puzzle.solution[0]),
		)!;
		const afterUnsafe = applyTurn(puzzle.state, unsafe);
		const reply = getLegalTurns(afterUnsafe)[0];
		expect(reply.captures).toHaveLength(1);
		expect(getOutcome(applyTurn(afterUnsafe, reply))).toEqual({
			winner: "light",
			reason: "capture",
		});
	});
});
