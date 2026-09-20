import {
	applyTurnUnchecked,
	createState,
	getLegalTurns,
	type GameState,
	type Turn,
} from "../src/core/engine";
import { twoPieceIndex, type TwoPieceFile } from "../src/ai/tablebase";

/** Exhaustive retrograde analysis of every legal one-piece-versus-one position.
 * Repetition and the progress clock are intentionally handled by the live probe. */
export function generateTwoPiece(): TwoPieceFile {
	const states = new Map<number, GameState>();
	for (let dark = 0; dark < 32; dark++)
		for (let light = 0; light < 32; light++) {
			if (dark === light) continue;
			for (const darkPiece of [1, 2])
				for (const lightPiece of [3, 4]) {
					if (
						(darkPiece === 1 && dark >= 28) ||
						(lightPiece === 3 && light < 4)
					)
						continue;
					for (const turn of ["dark", "light"] as const)
						for (const mandatoryCapture of [true, false]) {
							const board = Array<number>(32).fill(0);
							board[dark] = darkPiece;
							board[light] = lightPiece;
							const state = createState(board, turn, { mandatoryCapture });
							states.set(twoPieceIndex(state)!, state);
						}
				}
		}
	const wdl = new Int8Array(16384).fill(2);
	const distance = new Uint16Array(16384);
	const remaining = new Uint8Array(16384);
	const longest = new Uint16Array(16384);
	const destination = new Int8Array(16384).fill(-1);
	const predecessors: { parent: number; move: Turn }[][] = Array.from(
		{ length: 16384 },
		() => [],
	);
	const successors = new Map<number, { index: number; move: Turn }[]>();
	const buckets: number[][] = [[], []];
	const resolve = (index: number, outcome: number, dtm: number, to: number) => {
		wdl[index] = outcome;
		distance[index] = dtm;
		destination[index] = to;
		(buckets[dtm] ??= []).push(index);
	};
	for (const [index, state] of states) {
		const moves = getLegalTurns(state);
		remaining[index] = moves.length;
		const winningCapture = moves.find((move) => move.captures.length > 0);
		if (!moves.length) resolve(index, -1, 0, -1);
		else if (winningCapture) resolve(index, 1, 1, winningCapture.path[0]);
		const children = [];
		for (const move of moves) {
			if (move.captures.length) continue; // Capturing the only opponent wins immediately.
			const child = twoPieceIndex(applyTurnUnchecked(state, move))!;
			if (!states.has(child)) throw new Error("Missing tablebase successor");
			predecessors[child].push({ parent: index, move });
			children.push({ index: child, move });
		}
		successors.set(index, children);
	}
	// Processing DTM buckets in increasing order gives min-distance wins and
	// max-distance losses. Unresolved components after propagation are draws.
	for (let dtm = 0; dtm < buckets.length; dtm++) {
		for (const child of buckets[dtm] ?? []) {
			for (const { parent, move } of predecessors[child]) {
				if (wdl[parent] !== 2) continue;
				const to = move.path[move.path.length - 1];
				if (wdl[child] === -1) resolve(parent, 1, dtm + 1, to);
				else {
					remaining[parent]--;
					if (dtm >= longest[parent]) {
						longest[parent] = dtm;
						destination[parent] = to;
					}
					if (remaining[parent] === 0)
						resolve(parent, -1, longest[parent] + 1, destination[parent]);
				}
			}
		}
	}
	for (const index of states.keys()) {
		if (wdl[index] !== 2) continue;
		const safe = successors
			.get(index)!
			.find((child) => wdl[child.index] === 2 || wdl[child.index] === 0);
		if (!safe)
			throw new Error("An unresolved state lacks a drawing continuation");
		wdl[index] = 0;
		destination[index] = safe.move.path[safe.move.path.length - 1];
	}
	return {
		version: 1,
		kind: "two-piece",
		description:
			"Complete original retrograde WDL/DTM for every legal one-piece-versus-one position, men or kings, both moving sides and both capture settings. Cyclic unresolved components are draws. Values exclude history and the progress clock; the runtime only proves a win/loss when its decreasing-DTM strategy cannot encounter a history draw or the 80-turn boundary.",
		entries: [...states.keys()]
			.sort((a, b) => a - b)
			.map((index) => [index, wdl[index], distance[index], destination[index]]),
	};
}
