import {
	getLegalTurns,
	sideOf,
	type GameState,
	type Turn,
} from "../core/engine";

/** [position index, side-to-move WDL (-1/0/1), distance to terminal, destination]. */
export type TwoPieceEntry = [number, number, number, number];
export interface TwoPieceFile {
	version: 1;
	kind: "two-piece";
	description: string;
	entries: TwoPieceEntry[];
}

export function twoPieceIndex(state: GameState): number | null {
	let dark = -1;
	let light = -1;
	for (let square = 0; square < 32; square++) {
		if (sideOf(state.board[square]) === "dark") {
			if (dark >= 0) return null;
			dark = square;
		}
		if (sideOf(state.board[square]) === "light") {
			if (light >= 0) return null;
			light = square;
		}
	}
	if (dark < 0 || light < 0) return null;
	return (
		((((dark * 32 + light) * 2 + (state.board[dark] === 2 ? 1 : 0)) * 2 +
			(state.board[light] === 4 ? 1 : 0)) *
			2 +
			(state.turn === "light" ? 1 : 0)) *
			2 +
		(state.rules.mandatoryCapture ? 0 : 1)
	);
}

export interface TablebaseProbe {
	wdl: number;
	distance: number;
	move: Turn | null;
	proven: boolean;
}
export class TwoPieceTablebase {
	private values = new Int8Array(16384).fill(2);
	private distances = new Uint16Array(16384);
	private destinations = new Int8Array(16384).fill(-1);
	install(file: TwoPieceFile): void {
		if (
			file.version !== 1 ||
			file.kind !== "two-piece" ||
			!Array.isArray(file.entries) ||
			file.entries.length > 16384
		)
			return;
		for (const [index, wdl, distance, to] of file.entries) {
			if (
				!Number.isInteger(index) ||
				index < 0 ||
				index >= 16384 ||
				![-1, 0, 1].includes(wdl) ||
				!Number.isInteger(distance) ||
				distance < 0 ||
				distance > 65535 ||
				!Number.isInteger(to) ||
				to < -1 ||
				to >= 32
			)
				continue;
			this.values[index] = wdl;
			this.distances[index] = distance;
			this.destinations[index] = to;
		}
	}
	probe(state: GameState): TablebaseProbe | null {
		const index = twoPieceIndex(state);
		if (index === null || this.values[index] === 2) return null;
		const wdl = this.values[index];
		const distance = this.distances[index];
		const move =
			getLegalTurns(state).find(
				(move) => move.path[move.path.length - 1] === this.destinations[index],
			) ?? null;
		// A strictly decreasing DTM strategy cannot revisit a new position. An old
		// position with one occurrence may be crossed once safely; a twice-visited
		// position or an insufficient no-progress allowance requires normal search.
		// Draw WDL is a heuristic only: existing history might improve a losing side's
		// chances of drawing, so we do not let tablebase scores override live rules.
		const proven =
			wdl !== 0 &&
			state.noProgress + distance < 80 &&
			Object.values(state.repetitions).every((count) => count <= 1) &&
			(distance === 0 || move !== null);
		return { wdl, distance, move, proven };
	}
}
