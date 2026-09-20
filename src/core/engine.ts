/** American/English checkers. Squares are 0–31, from dark's home row. */
export type Side = "dark" | "light";
export interface Rules {
	mandatoryCapture: boolean;
}
export interface GameState {
	board: number[];
	turn: Side;
	rules: Rules;
	noProgress: number;
	repetitions: Record<string, number>;
	ply: number;
}
/** One complete turn, including every landing in a multiple capture. */
export interface Turn {
	from: number;
	path: number[];
	captures: number[];
	promotion: boolean;
}
export interface Outcome {
	winner: Side | null;
	reason:
		| "capture"
		| "blocked"
		| "repetition"
		| "no-progress"
		| "resignation"
		| "timeout"
		| "agreement";
}
export type GameOutcome = Outcome | null;

export const DEFAULT_RULES: Readonly<Rules> = Object.freeze({
	mandatoryCapture: true,
});
export const opponent = (side: Side): Side =>
	side === "dark" ? "light" : "dark";
export const sideOf = (piece: number): Side | null =>
	piece === 1 || piece === 2
		? "dark"
		: piece === 3 || piece === 4
			? "light"
			: null;
export const isKing = (piece: number): boolean => piece === 2 || piece === 4;

/** Coordinates include the unplayable light squares; invalid squares return -1. */
export function getSquare(row: number, col: number): number {
	return Number.isInteger(row) &&
		Number.isInteger(col) &&
		row >= 0 &&
		row < 8 &&
		col >= 0 &&
		col < 8 &&
		(row + col) % 2 === 1
		? row * 4 + Math.floor(col / 2)
		: -1;
}
export function getCoords(square: number): [number, number] {
	if (!Number.isInteger(square) || square < 0 || square >= 32) return [-1, -1];
	const row = Math.floor(square / 4);
	return [row, (square % 4) * 2 + (row % 2 === 0 ? 1 : 0)];
}

// Geometry is computed once and shared by quiet move and capture generation.
const directions: readonly [number, number][] = [
	[1, -1],
	[1, 1],
	[-1, -1],
	[-1, 1],
];
export const GEOMETRY = Object.freeze(
	Array.from({ length: 32 }, (_, square) => {
		const [row, col] = getCoords(square);
		return Object.freeze(
			directions.map(([dr, dc]) =>
				Object.freeze({
					step: getSquare(row + dr, col + dc),
					jump: getSquare(row + dr * 2, col + dc * 2),
				}),
			),
		);
	}),
);
const directionIndices = (piece: number): readonly number[] =>
	isKing(piece)
		? KING_DIRECTIONS
		: piece === 1
			? DARK_DIRECTIONS
			: LIGHT_DIRECTIONS;
const DARK_DIRECTIONS = [0, 1] as const;
const LIGHT_DIRECTIONS = [2, 3] as const;
const KING_DIRECTIONS = [0, 1, 2, 3] as const;
const promotes = (piece: number, square: number): boolean =>
	piece === 1 ? square >= 28 : piece === 3 && square < 4;

/** Board, moving side, and rules identify a repetition, excluding clocks. */
export function positionKey(
	state: Pick<GameState, "board" | "turn" | "rules">,
): string {
	return `${state.board.join("")}:${state.turn === "dark" ? "d" : "l"}:${state.rules.mandatoryCapture ? "m" : "o"}`;
}

export function createState(
	board: number[],
	turn: Side = "dark",
	rules: Rules = DEFAULT_RULES,
): GameState {
	if (
		!Array.isArray(board) ||
		board.length !== 32 ||
		Array.from(board).some(
			(piece) => !Number.isInteger(piece) || piece < 0 || piece > 4,
		)
	) {
		throw new Error(
			"A position must contain exactly 32 squares with piece codes from 0 to 4.",
		);
	}
	if (turn !== "dark" && turn !== "light")
		throw new Error("The moving side must be dark or light.");
	if (!rules || typeof rules.mandatoryCapture !== "boolean")
		throw new Error("Choose whether captures are mandatory.");
	for (const side of ["dark", "light"] as const) {
		if (board.filter((piece) => sideOf(piece) === side).length > 12)
			throw new Error("A side cannot have more than 12 pieces.");
	}
	if (board.slice(28).includes(1) || board.slice(0, 4).includes(3))
		throw new Error("A man on its promotion row must be a king.");
	const state: GameState = {
		board: [...board],
		turn,
		rules: { ...rules },
		noProgress: 0,
		repetitions: {},
		ply: 0,
	};
	state.repetitions[positionKey(state)] = 1;
	return state;
}

export function createInitialState(rules: Rules = DEFAULT_RULES): GameState {
	return createState(
		Array.from({ length: 32 }, (_, square) =>
			square < 12 ? 1 : square >= 20 ? 3 : 0,
		),
		"dark",
		rules,
	);
}

/** Generate complete turns. Men only capture forward, and crowning ends a turn. */
export function getLegalTurns(state: GameState): Turn[] {
	const captures: Turn[] = [];
	const quiet: Turn[] = [];
	const board = state.board.slice();
	const enemy = opponent(state.turn);

	const extendCapture = (
		from: number,
		square: number,
		piece: number,
		path: number[],
		taken: number[],
	): void => {
		let continued = false;
		for (const direction of directionIndices(piece)) {
			const { step, jump } = GEOMETRY[square][direction];
			if (jump < 0 || board[jump] !== 0 || sideOf(board[step]) !== enemy)
				continue;
			continued = true;
			const victim = board[step];
			board[square] = 0;
			board[step] = 0;
			board[jump] = piece;
			path.push(jump);
			taken.push(step);
			if (promotes(piece, jump)) {
				captures.push({
					from,
					path: [...path],
					captures: [...taken],
					promotion: true,
				});
			} else {
				extendCapture(from, jump, piece, path, taken);
			}
			taken.pop();
			path.pop();
			board[jump] = 0;
			board[step] = victim;
			board[square] = piece;
		}
		if (!continued && taken.length)
			captures.push({
				from,
				path: [...path],
				captures: [...taken],
				promotion: false,
			});
	};

	for (let from = 0; from < 32; from++) {
		const piece = board[from];
		if (sideOf(piece) !== state.turn) continue;
		extendCapture(from, from, piece, [], []);
		for (const direction of directionIndices(piece)) {
			const { step } = GEOMETRY[from][direction];
			if (step >= 0 && board[step] === 0)
				quiet.push({
					from,
					path: [step],
					captures: [],
					promotion: promotes(piece, step),
				});
		}
	}
	return captures.length && state.rules.mandatoryCapture
		? captures
		: [...captures, ...quiet];
}

export function sameTurn(a: Turn, b: Turn): boolean {
	return (
		a.from === b.from &&
		a.promotion === b.promotion &&
		a.path.length === b.path.length &&
		a.path.every((square, index) => square === b.path[index]) &&
		a.captures.length === b.captures.length &&
		a.captures.every((square, index) => square === b.captures[index])
	);
}

export function notation(turn: Turn): string {
	return [turn.from, ...turn.path]
		.map((square) => square + 1)
		.join(turn.captures.length ? "x" : "-");
}

export interface UndoState {
	changes: [number, number][];
	turn: Side;
	noProgress: number;
	ply: number;
	repetitions: Record<string, number>;
	repetitionKey: string;
	previousCount: number;
}

/** Search-only mutable operation. The caller must supply a generated legal turn. */
export function makeTurn(state: GameState, turn: Turn): UndoState {
	const to = turn.path[turn.path.length - 1];
	const piece = state.board[turn.from];
	const changed = [...new Set([turn.from, to, ...turn.captures])];
	const undo: UndoState = {
		changes: changed.map((square) => [square, state.board[square]]),
		turn: state.turn,
		noProgress: state.noProgress,
		ply: state.ply,
		repetitions: state.repetitions,
		repetitionKey: "",
		previousCount: 0,
	};
	state.board[turn.from] = 0;
	for (const square of turn.captures) state.board[square] = 0;
	state.board[to] = turn.promotion ? piece + 1 : piece;
	state.turn = opponent(state.turn);
	state.ply++;
	const irreversible = turn.captures.length > 0 || !isKing(piece);
	state.noProgress = irreversible ? 0 : state.noProgress + 1;
	// Captures and forward-only man moves cannot return to an earlier position.
	if (irreversible) state.repetitions = {};
	const key = positionKey(state);
	undo.repetitionKey = key;
	undo.previousCount = state.repetitions[key] ?? 0;
	state.repetitions[key] = undo.previousCount + 1;
	return undo;
}

export function unmakeTurn(state: GameState, undo: UndoState): void {
	for (const [square, piece] of undo.changes) state.board[square] = piece;
	state.turn = undo.turn;
	state.noProgress = undo.noProgress;
	state.ply = undo.ply;
	if (state.repetitions === undo.repetitions) {
		if (undo.previousCount === 0) delete state.repetitions[undo.repetitionKey];
		else state.repetitions[undo.repetitionKey] = undo.previousCount;
	}
	state.repetitions = undo.repetitions;
}

/** Fast immutable application for callers that already generated a legal turn. */
export function applyTurnUnchecked(state: GameState, turn: Turn): GameState {
	const next = {
		...state,
		board: [...state.board],
		rules: { ...state.rules },
		repetitions: { ...state.repetitions },
	};
	makeTurn(next, turn);
	return next;
}

export function applyTurn(state: GameState, turn: Turn): GameState {
	if (
		!turn ||
		!Array.isArray(turn.path) ||
		!Array.isArray(turn.captures) ||
		!getLegalTurns(state).some((legal) => sameTurn(legal, turn))
	) {
		throw new Error("That is not a complete legal turn in this position.");
	}
	if (getOutcome(state)) throw new Error("This game has already ended.");
	return applyTurnUnchecked(state, turn);
}

/** Elimination or inability to move wins before a draw is adjudicated. */
export function getOutcome(state: GameState): GameOutcome {
	let own = 0;
	let other = 0;
	for (const piece of state.board) {
		if (sideOf(piece) === state.turn) own++;
		else if (sideOf(piece)) other++;
	}
	if (!own) return { winner: opponent(state.turn), reason: "capture" };
	if (!other) return { winner: state.turn, reason: "capture" };
	if (!getLegalTurns(state).length)
		return { winner: opponent(state.turn), reason: "blocked" };
	if ((state.repetitions[positionKey(state)] ?? 0) >= 3)
		return { winner: null, reason: "repetition" };
	if (state.noProgress >= 80) return { winner: null, reason: "no-progress" };
	return null;
}
