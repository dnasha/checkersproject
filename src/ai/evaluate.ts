import {
	getCoords,
	getSquare,
	isKing,
	sideOf,
	type GameState,
} from "../core/engine";

/** Precomputed geometry is shared by the inexpensive positional features. */
const GEOMETRY = Array.from({ length: 32 }, (_, square) => {
	const [row, col] = getCoords(square);
	return {
		row,
		col,
		adjacent: [-1, 1].flatMap((dr) =>
			[-1, 1].map((dc) => getSquare(row + dr, col + dc)),
		),
	};
});

/** Static estimate only; terminal positions are adjudicated by the search. */
export function evaluate(state: GameState): number {
	let dark = 0;
	let light = 0;
	const count = state.board.filter(Boolean).length;
	const endgame = 1 - Math.min(1, count / 16);
	const squares: number[][] = [[], []];
	for (let sq = 0; sq < 32; sq++) {
		const piece = state.board[sq];
		if (!piece) continue;
		const king = isKing(piece);
		const isDark = sideOf(piece) === "dark";
		const { row, col, adjacent } = GEOMETRY[sq];
		const advancement = isDark ? row : 7 - row;
		let score = king ? 180 + endgame * 30 : 100;
		const center = 7 - Math.abs(3.5 - row) - Math.abs(3.5 - col);
		score += center * (king ? 3 : 1.2);
		if (!king) {
			score += advancement * (3 + 4 * endgame);
			if (advancement === 0) score += 9 * (1 - endgame);
			if (advancement >= 5) score += 10;
		}
		let mobility = 0;
		let support = 0;
		let vulnerable = false;
		for (const next of adjacent) {
			if (next < 0) continue;
			const neighbor = state.board[next];
			const [nr, nc] = getCoords(next);
			const forward = isDark ? nr > row : nr < row;
			if (!neighbor && (king || forward)) mobility++;
			else if (neighbor && sideOf(neighbor) === sideOf(piece)) support++;
			else if (neighbor) {
				const behind = getSquare(row + row - nr, col + col - nc);
				// The enemy must be able to move toward this piece, then land beyond it.
				const enemyForward = sideOf(neighbor) === "dark" ? row > nr : row < nr;
				if (
					behind >= 0 &&
					state.board[behind] === 0 &&
					(isKing(neighbor) || enemyForward)
				)
					vulnerable = true;
			}
		}
		score += mobility * (king ? 3.5 : 2) + Math.min(2, support) * 3;
		if (mobility === 0 && king) score -= 12;
		if (vulnerable) score -= king ? 18 : 12;
		if (!king && advancement >= 4 && mobility > 0)
			score += (advancement - 3) * 4;
		squares[isDark ? 0 : 1].push(sq);
		if (isDark) dark += score;
		else light += score;
	}
	// Convert a material lead by bringing the remaining pieces into contact.
	if (
		endgame > 0 &&
		squares[0].length &&
		squares[1].length &&
		Math.abs(dark - light) > 70
	) {
		const leader = dark > light ? 0 : 1;
		let distance = 0;
		for (const sq of squares[leader]) {
			const a = GEOMETRY[sq];
			distance += Math.min(
				...squares[1 - leader].map((other) => {
					const b = GEOMETRY[other];
					return Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
				}),
			);
		}
		const bonus = (7 - distance / squares[leader].length) * 5 * endgame;
		if (leader === 0) dark += bonus;
		else light += bonus;
	}
	return Math.round(dark - light);
}
