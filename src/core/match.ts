import {
	applyTurn,
	createInitialState,
	createState,
	getLegalTurns,
	getOutcome,
	opponent,
	sameTurn,
	type GameState,
	type GameOutcome,
	type Side,
	type Turn,
} from "./engine";

export type Mode = "practice" | "challenge" | "local";
export type TimeControl = "off" | "3+3" | "5+3" | "10+5";
export type Difficulty = "beginner" | "casual" | "challenging" | "expert";
export interface MatchConfig {
	mode: Mode;
	difficulty: Difficulty;
	humanSide: Side;
	mandatoryCapture: boolean;
	timeControl: TimeControl;
}
export interface Remaining {
	dark: number;
	light: number;
}
export interface HistoryEntry {
	turn: Turn;
	state: GameState;
	remaining: Remaining;
	evaluation?: number;
}
export interface Match {
	version: 1;
	id: string;
	createdAt: number;
	updatedAt: number;
	config: MatchConfig;
	initial: GameState;
	state: GameState;
	history: HistoryEntry[];
	pending: { from: number; path: number[] } | null;
	clock: {
		remaining: Remaining;
		incrementMs: number;
		active: Side | null;
		anchor: number;
		paused: boolean;
	};
	outcome: GameOutcome;
}

// Epoch-compatible for persistence; monotonic between page loads.
const epoch = Date.now();
const origin = performance.now();
export const now = () => epoch + performance.now() - origin;
const controls: Record<TimeControl, [number, number]> = {
	off: [0, 0],
	"3+3": [180000, 3000],
	"5+3": [300000, 3000],
	"10+5": [600000, 5000],
};
const clone = <T>(value: T): T => structuredClone(value);

export function newMatch(
	config: MatchConfig,
	initial?: GameState,
	at = now(),
): Match {
	validateConfig(config);
	const state = initial
		? createState(initial.board, initial.turn, {
				mandatoryCapture: config.mandatoryCapture,
			})
		: createInitialState({ mandatoryCapture: config.mandatoryCapture });
	const [time, increment] = controls[config.timeControl];
	const outcome = getOutcome(state);
	return {
		version: 1,
		id: crypto.randomUUID(),
		createdAt: at,
		updatedAt: at,
		config: { ...config },
		initial: clone(state),
		state,
		history: [],
		pending: null,
		clock: {
			remaining: { dark: time, light: time },
			incrementMs: increment,
			active: time && !outcome ? state.turn : null,
			anchor: at,
			paused: false,
		},
		outcome,
	};
}

export function settleClock(match: Match, at = now()): Match {
	if (match.outcome || match.clock.paused || !match.clock.active) return match;
	const side = match.clock.active;
	const elapsed = Math.max(0, at - match.clock.anchor);
	if (!elapsed && match.clock.remaining[side] > 0) return match;
	const remaining = {
		...match.clock.remaining,
		[side]: Math.max(0, match.clock.remaining[side] - elapsed),
	};
	const outcome: GameOutcome =
		remaining[side] <= 0 ? { winner: opponent(side), reason: "timeout" } : null;
	return {
		...match,
		updatedAt: at,
		outcome,
		pending: outcome ? null : match.pending,
		clock: {
			...match.clock,
			remaining,
			anchor: at,
			active: outcome ? null : side,
		},
	};
}

export function commitTurn(match: Match, turn: Turn, at = now()): Match {
	const current = settleClock(match, at);
	if (current.outcome) return current;
	if (current.clock.paused) throw new Error("Resume this game before moving.");
	if (
		current.pending &&
		(current.pending.from !== turn.from ||
			!current.pending.path.every((s, i) => turn.path[i] === s))
	)
		throw new Error("Complete the capture with the selected piece.");
	const state = applyTurn(current.state, turn);
	const outcome = getOutcome(state);
	const remaining = { ...current.clock.remaining };
	if (current.config.timeControl !== "off")
		remaining[current.state.turn] += current.clock.incrementMs;
	return {
		...current,
		state,
		outcome,
		pending: null,
		updatedAt: at,
		history: [
			...current.history,
			{ turn: clone(turn), state: clone(state), remaining: { ...remaining } },
		],
		clock: {
			...current.clock,
			remaining,
			anchor: at,
			active:
				outcome || current.config.timeControl === "off" ? null : state.turn,
		},
	};
}

export function pauseMatch(match: Match, at = now()): Match {
	const current = settleClock(match, at);
	if (current.outcome) return current;
	return {
		...current,
		updatedAt: at,
		clock: { ...current.clock, anchor: at, active: null, paused: true },
	};
}
export function resumeMatch(match: Match, at = now()): Match {
	if (match.outcome) return match;
	// Repeated resume events must not forgive time already spent thinking.
	if (!match.clock.paused) return settleClock(match, at);
	return {
		...match,
		updatedAt: at,
		clock: {
			...match.clock,
			anchor: at,
			active: match.config.timeControl === "off" ? null : match.state.turn,
			paused: false,
		},
	};
}
export function canUndo(match: Match): boolean {
	if (match.config.mode === "challenge" || match.config.timeControl !== "off")
		return false;
	if (match.pending) return true;
	if (match.config.mode === "local") return match.history.length > 0;
	// When playing light there is no human decision to undo after AI's opening.
	return match.history.some(
		(_, index) =>
			(index === 0
				? match.initial.turn
				: match.history[index - 1].state.turn) === match.config.humanSide,
	);
}
export function undoMatch(match: Match, at = now()): Match {
	if (!canUndo(match))
		throw new Error(
			"Takebacks are available in untimed practice and local games.",
		);
	if (match.pending) return { ...match, pending: null, updatedAt: at };
	let history = match.history.slice(0, -1);
	if (match.config.mode !== "local") {
		while (
			history.length &&
			history[history.length - 1].state.turn !== match.config.humanSide
		)
			history = history.slice(0, -1);
	}
	const state = clone(
		history.length ? history[history.length - 1].state : match.initial,
	);
	return {
		...match,
		state,
		history,
		pending: null,
		outcome: getOutcome(state),
		updatedAt: at,
		clock: { ...match.clock, anchor: at, active: null },
	};
}
export function finishMatch(
	match: Match,
	outcome: NonNullable<GameOutcome>,
	at = now(),
): Match {
	const current = settleClock(match, at);
	if (current.outcome) return current;
	return {
		...current,
		outcome,
		pending: null,
		updatedAt: at,
		clock: { ...current.clock, active: null, anchor: at },
	};
}

function validateConfig(value: MatchConfig): void {
	if (
		!value ||
		!["practice", "challenge", "local"].includes(value.mode) ||
		!["beginner", "casual", "challenging", "expert"].includes(
			value.difficulty,
		) ||
		!["dark", "light"].includes(value.humanSide) ||
		typeof value.mandatoryCapture !== "boolean" ||
		!Object.hasOwn(controls, value.timeControl)
	)
		throw new Error("Invalid game settings.");
}
function finite(
	value: unknown,
	min = 0,
	max = Number.MAX_SAFE_INTEGER,
): value is number {
	return (
		typeof value === "number" &&
		Number.isFinite(value) &&
		value >= min &&
		value <= max
	);
}
function remaining(value: Remaining): Remaining {
	if (
		!value ||
		!finite(value.dark, 0, 86400000) ||
		!finite(value.light, 0, 86400000)
	)
		throw new Error("Invalid clock data.");
	return { dark: value.dark, light: value.light };
}

/** Rebuild imported history from legal turns; never trust serialized derived state. */
export function validateMatch(input: unknown): Match {
	if (!input || typeof input !== "object")
		throw new Error("This is not an Astra game.");
	const raw = input as Match;
	if (raw.version !== 1)
		throw new Error("This game uses an unsupported save version.");
	validateConfig(raw.config);
	if (
		typeof raw.id !== "string" ||
		!/^[\w-]{1,80}$/.test(raw.id) ||
		!finite(raw.createdAt, 0, 8_640_000_000_000_000) ||
		!finite(raw.updatedAt, 0, 8_640_000_000_000_000) ||
		!Array.isArray(raw.history) ||
		raw.history.length > 5000 ||
		!raw.initial ||
		!["dark", "light"].includes(raw.initial.turn)
	)
		throw new Error("Invalid game record.");
	const initial = createState(raw.initial.board, raw.initial.turn, {
		mandatoryCapture: raw.config.mandatoryCapture,
	});
	let state = initial;
	const history: HistoryEntry[] = [];
	for (const entry of raw.history) {
		if (getOutcome(state))
			throw new Error("Game contains moves after it ended.");
		if (
			!entry?.turn ||
			!Array.isArray(entry.turn.path) ||
			!Array.isArray(entry.turn.captures)
		)
			throw new Error(`Illegal move at turn ${history.length + 1}.`);
		const legal = getLegalTurns(state).find((turn) =>
			sameTurn(turn, entry?.turn),
		);
		if (!legal) throw new Error(`Illegal move at turn ${history.length + 1}.`);
		state = applyTurn(state, legal);
		const item: HistoryEntry = {
			turn: legal,
			state: clone(state),
			remaining: remaining(entry.remaining),
		};
		if (finite(entry.evaluation, -1000000, 1000000))
			item.evaluation = entry.evaluation;
		history.push(item);
	}
	let pending: Match["pending"] = null;
	if (raw.pending) {
		const { from, path } = raw.pending;
		if (
			!Number.isInteger(from) ||
			!Array.isArray(path) ||
			!path.length ||
			path.length > 12 ||
			!path.every(Number.isInteger) ||
			!getLegalTurns(state).some(
				(turn) =>
					turn.from === from &&
					turn.path.length > path.length &&
					path.every((sq, i) => turn.path[i] === sq),
			)
		)
			throw new Error("Invalid unfinished capture.");
		pending = { from, path: [...path] };
	}
	if (
		!raw.clock ||
		!finite(raw.clock.anchor) ||
		typeof raw.clock.paused !== "boolean"
	)
		throw new Error("Invalid clock.");
	const clockRemaining = remaining(raw.clock.remaining);
	let outcome = getOutcome(state);
	if (!outcome && raw.outcome) {
		if (
			!["resignation", "timeout", "agreement"].includes(raw.outcome.reason) ||
			![null, "dark", "light"].includes(raw.outcome.winner)
		)
			throw new Error("Invalid game result.");
		if (
			raw.outcome.reason === "agreement"
				? raw.outcome.winner !== null
				: raw.outcome.winner === null
		)
			throw new Error("Invalid winner.");
		if (
			raw.outcome.reason === "timeout" &&
			(raw.config.timeControl === "off" ||
				clockRemaining[opponent(raw.outcome.winner!)] > 0)
		)
			throw new Error("Invalid timeout.");
		outcome = { ...raw.outcome };
	}
	return {
		version: 1,
		id: raw.id,
		createdAt: raw.createdAt,
		updatedAt: raw.updatedAt,
		config: { ...raw.config },
		initial,
		state,
		history,
		pending: outcome ? null : pending,
		outcome,
		clock: {
			remaining: clockRemaining,
			incrementMs: controls[raw.config.timeControl][1],
			anchor: raw.clock.anchor,
			paused: raw.clock.paused,
			active:
				outcome || raw.clock.paused || raw.config.timeControl === "off"
					? null
					: state.turn,
		},
	};
}
