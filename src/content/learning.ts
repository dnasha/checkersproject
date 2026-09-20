import {
	applyTurn,
	createState,
	getLegalTurns,
	getSquare,
	type GameState,
	type Side,
	type Turn,
} from "../core/engine";

/** Goals describe observable facts, rather than unverified claims of best play. */
export interface LearningGoal {
	captures?: number;
	promotes?: boolean;
	destination?: number;
	outcome?: { winner: Side; reason: "capture" | "blocked" };
	safe?: boolean;
}
export interface Lesson {
	id: string;
	title: string;
	description: string;
	instruction: string;
	state: GameState;
	solution: Turn[];
	explanation: string;
	goal: LearningGoal;
}
export interface Puzzle {
	id: string;
	title: string;
	category: "captures" | "kings" | "promotion" | "tactics";
	difficulty: "beginner" | "intermediate" | "advanced";
	state: GameState;
	solution: Turn[];
	/** Equally successful complete routes, accepted alongside the primary route. */
	alternatives?: Turn[][];
	hint: string;
	explanation: string;
	goal: LearningGoal;
}

type Piece = [row: number, col: number, code: number];
type Point = [row: number, col: number];
type Route = Point[];

function position(pieces: Piece[], turn: Side = "dark"): GameState {
	const board = Array<number>(32).fill(0);
	for (const [row, col, code] of pieces) {
		const square = getSquare(row, col);
		if (square < 0 || board[square])
			throw new Error("Invalid authored learning position.");
		board[square] = code;
	}
	return createState(board, turn);
}

function solution(state: GameState, routes: Route[]): Turn[] {
	let current = state;
	return routes.map((route) => {
		const [from, ...path] = route.map(([row, col]) => getSquare(row, col));
		const legal = getLegalTurns(current).find(
			(turn) =>
				turn.from === from &&
				turn.path.length === path.length &&
				turn.path.every((square, index) => square === path[index]),
		);
		if (!legal)
			throw new Error(
				`Invalid authored learning solution: ${[from, ...path].join(",")}`,
			);
		current = applyTurn(current, legal);
		return legal;
	});
}

function lesson(
	spec: Omit<Lesson, "state" | "solution"> & {
		pieces: Piece[];
		route: Route;
		side?: Side;
	},
): Lesson {
	const { pieces, route, side, ...content } = spec;
	const state = position(pieces, side);
	return { ...content, state, solution: solution(state, [route]) };
}

function puzzle(
	spec: Omit<Puzzle, "state" | "solution" | "alternatives"> & {
		pieces: Piece[];
		route: Route;
		otherRoutes?: Route[];
		side?: Side;
	},
): Puzzle {
	const { pieces, route, otherRoutes, side, ...content } = spec;
	const state = position(pieces, side);
	return {
		...content,
		state,
		solution: solution(state, [route]),
		...(otherRoutes
			? { alternatives: otherRoutes.map((other) => solution(state, [other])) }
			: {}),
	};
}

export const lessons: Lesson[] = [
	lesson({
		id: "movement",
		title: "1. Your first move",
		description: "Men move one square diagonally forward on the dark squares.",
		instruction: "Move the dark man from square 10 to square 15.",
		pieces: [
			[2, 3, 1],
			[6, 7, 3],
		],
		route: [
			[2, 3],
			[3, 4],
		],
		goal: { destination: 14, captures: 0 },
		explanation:
			"Dark moves toward the higher square numbers. A man steps diagonally into an empty square; it cannot move sideways or backward.",
	}),
	lesson({
		id: "captures",
		title: "2. Make a capture",
		description:
			"Jump over an adjacent opponent into the empty square beyond it.",
		instruction:
			"Jump from square 9 to square 18, taking the light man on square 14.",
		pieces: [
			[2, 1, 1],
			[3, 2, 3],
			[6, 7, 3],
		],
		route: [
			[2, 1],
			[4, 3],
		],
		goal: { captures: 1 },
		explanation:
			"The jumped piece leaves the board. Men capture forward, and the landing square must be empty.",
	}),
	lesson({
		id: "compulsory",
		title: "3. Keep jumping",
		description:
			"Captures are compulsory, and the same piece must finish its available jumps.",
		instruction:
			"Start on square 5. Land on 14, then 23, to finish the double capture.",
		pieces: [
			[1, 0, 1],
			[2, 7, 1],
			[2, 1, 3],
			[4, 3, 3],
		],
		route: [
			[1, 0],
			[3, 2],
			[5, 4],
		],
		goal: { captures: 2 },
		explanation:
			"This is one complete turn. You cannot stop on 14 or switch to the other dark man. The optional-capture house rule changes whether you must start a jump, not whether you must finish it.",
	}),
	lesson({
		id: "kings",
		title: "4. A king can go back",
		description:
			"A crowned king moves and captures diagonally in both directions.",
		instruction:
			"Use the dark king on square 19 to jump backward to square 10.",
		pieces: [
			[4, 5, 2],
			[3, 4, 3],
			[7, 0, 3],
		],
		route: [
			[4, 5],
			[2, 3],
		],
		goal: { captures: 1, destination: 9 },
		explanation:
			"Kings gain backward movement, but still step one square or jump one adjacent piece at a time. They are not flying kings.",
	}),
	lesson({
		id: "tactics",
		title: "5. Read the whole route",
		description:
			"When several captures are available, look beyond the first landing.",
		instruction:
			"From square 6, choose the route through 15 and 24 to take two pieces.",
		pieces: [
			[1, 2, 1],
			[2, 1, 3],
			[2, 3, 3],
			[4, 5, 3],
		],
		route: [
			[1, 2],
			[3, 4],
			[5, 6],
		],
		goal: { captures: 2 },
		explanation:
			"The other route takes only one piece. American checkers lets you choose either complete capture; it does not require the longest one. Here the lesson asks you to spot the double jump.",
	}),
	lesson({
		id: "endings",
		title: "6. Win by closing the door",
		description: "A player with no legal move loses, even with a piece left.",
		instruction:
			"Move the dark king from square 6 to square 1 to block the light man.",
		pieces: [
			[1, 2, 2],
			[1, 0, 3],
		],
		route: [
			[1, 2],
			[0, 1],
		],
		goal: { outcome: { winner: "dark", reason: "blocked" } },
		explanation:
			"Light has no empty forward square. It cannot jump past the edge of the board, so dark wins by blockade. The game also uses automatic threefold and 80-turn no-progress draws.",
	}),
];

export const puzzles: Puzzle[] = [
	puzzle({
		id: "capture-01",
		title: "The compulsory detour",
		category: "captures",
		difficulty: "beginner",
		pieces: [
			[2, 5, 1],
			[2, 1, 1],
			[3, 4, 3],
			[6, 1, 3],
		],
		route: [
			[2, 5],
			[4, 3],
		],
		goal: { captures: 1 },
		hint: "Find the capture. A quiet move by the other dark man is unavailable.",
		explanation:
			"11x18 takes the adjacent light man. An available capture takes priority over every quiet move.",
	}),
	puzzle({
		id: "capture-02",
		title: "Along the rail",
		category: "captures",
		difficulty: "beginner",
		pieces: [
			[0, 3, 1],
			[1, 4, 3],
			[3, 6, 3],
			[7, 0, 3],
		],
		route: [
			[0, 3],
			[2, 5],
			[4, 7],
		],
		goal: { captures: 2 },
		hint: "Take two men in a single turn. The second landing is on the right edge.",
		explanation:
			"2x11x20 captures two men. Reaching an edge stops this route because there is no further legal forward jump.",
	}),
	puzzle({
		id: "capture-03",
		title: "Three in a line",
		category: "captures",
		difficulty: "intermediate",
		pieces: [
			[0, 1, 1],
			[1, 2, 3],
			[3, 4, 3],
			[5, 6, 3],
			[7, 0, 3],
		],
		route: [
			[0, 1],
			[2, 3],
			[4, 5],
			[6, 7],
		],
		goal: { captures: 3 },
		hint: "Follow all three forward jumps. Do not stop after the second capture.",
		explanation:
			"1x10x19x28 takes three pieces while remaining a man. Square 28 is still one row short of promotion.",
	}),
	puzzle({
		id: "capture-04",
		title: "Take the longer fork",
		category: "captures",
		difficulty: "intermediate",
		pieces: [
			[1, 4, 1],
			[2, 3, 3],
			[4, 1, 3],
			[2, 5, 3],
		],
		route: [
			[1, 4],
			[3, 2],
			[5, 0],
		],
		goal: { captures: 2 },
		hint: "Both first jumps are legal. Find the route that takes two pieces.",
		explanation:
			"7x14x21 takes two men; 7x16 takes one. The shorter route is legal under American rules, but does not meet this puzzle’s goal.",
	}),
	puzzle({
		id: "capture-05",
		title: "A man takes two crowns",
		category: "captures",
		difficulty: "intermediate",
		pieces: [
			[2, 1, 1],
			[3, 2, 4],
			[5, 4, 4],
			[0, 7, 4],
		],
		route: [
			[2, 1],
			[4, 3],
			[6, 5],
		],
		goal: { captures: 2 },
		hint: "Kings can be captured just like men. Take the two crowns in the forward chain.",
		explanation:
			"9x18x27 removes two kings. A man does not need to be crowned to capture a king.",
	}),
	puzzle({
		id: "capture-06",
		title: "Light clears the staircase",
		category: "captures",
		difficulty: "advanced",
		side: "light",
		pieces: [
			[6, 5, 3],
			[7, 0, 3],
			[5, 4, 1],
			[3, 2, 1],
			[1, 2, 1],
		],
		route: [
			[6, 5],
			[4, 3],
			[2, 1],
			[0, 3],
		],
		goal: {
			captures: 3,
			promotes: true,
			outcome: { winner: "light", reason: "capture" },
		},
		hint: "Light moves toward the lower numbers. Take all three dark men and finish on the crown row.",
		explanation:
			"27x18x9x2 turns left, then right, removing the last three dark pieces and crowning the light man.",
	}),
	puzzle({
		id: "king-01",
		title: "Look behind you",
		category: "kings",
		difficulty: "beginner",
		pieces: [
			[5, 4, 2],
			[4, 3, 3],
			[1, 6, 3],
		],
		route: [
			[5, 4],
			[3, 2],
		],
		goal: { captures: 1 },
		hint: "The crown allows a backward capture toward the smaller square numbers.",
		explanation:
			"23x14 is legal for a dark king. A dark man in the same position could not make this backward jump.",
	}),
	puzzle({
		id: "king-02",
		title: "Change direction",
		category: "kings",
		difficulty: "intermediate",
		pieces: [
			[4, 3, 2],
			[3, 4, 3],
			[3, 6, 3],
			[7, 2, 3],
		],
		route: [
			[4, 3],
			[2, 5],
			[4, 7],
		],
		goal: { captures: 2 },
		hint: "Jump backward first, then forward, to take both men.",
		explanation:
			"18x11x20 changes vertical direction between jumps. A king may do that inside the same complete turn.",
	}),
	puzzle({
		id: "king-03",
		title: "A full circuit",
		category: "kings",
		difficulty: "advanced",
		pieces: [
			[2, 3, 2],
			[3, 4, 3],
			[5, 4, 3],
			[5, 2, 3],
			[3, 2, 3],
		],
		route: [
			[2, 3],
			[4, 5],
			[6, 3],
			[4, 1],
			[2, 3],
		],
		otherRoutes: [
			[
				[2, 3],
				[4, 1],
				[6, 3],
				[4, 5],
				[2, 3],
			],
		],
		goal: {
			captures: 4,
			destination: 9,
			outcome: { winner: "dark", reason: "capture" },
		},
		hint: "Take all four men and return to your starting square. Either direction around the loop works.",
		explanation:
			"The vacated starting square can be used again. Both 10x19x26x17x10 and its reverse take all four opponents without capturing any piece twice.",
	}),
	puzzle({
		id: "king-04",
		title: "The backward climb",
		category: "kings",
		difficulty: "intermediate",
		pieces: [
			[6, 1, 2],
			[5, 2, 3],
			[3, 4, 3],
			[1, 4, 3],
			[7, 6, 3],
		],
		route: [
			[6, 1],
			[4, 3],
			[2, 5],
			[0, 3],
		],
		goal: { captures: 3 },
		hint: "Your king can keep climbing toward its home row. Find three captures.",
		explanation:
			"25x18x11x2 takes three men through backward jumps. An existing king can continue capturing after reaching either edge, if another jump exists.",
	}),
	puzzle({
		id: "king-05",
		title: "Weave across the crown row",
		category: "kings",
		difficulty: "advanced",
		pieces: [
			[0, 7, 2],
			[1, 6, 3],
			[1, 4, 3],
			[1, 2, 3],
			[7, 4, 3],
		],
		route: [
			[0, 7],
			[2, 5],
			[0, 3],
			[2, 1],
		],
		goal: { captures: 3 },
		hint: "Alternate down, up, then down. You are already a king, so touching the edge does not end the chain.",
		explanation:
			"4x11x2x9 takes three pieces. The rule ending a turn on promotion applies to a newly crowned man, not to a piece that was already a king.",
	}),
	puzzle({
		id: "king-06",
		title: "Light turns the corner",
		category: "kings",
		difficulty: "advanced",
		side: "light",
		pieces: [
			[3, 0, 4],
			[2, 1, 1],
			[2, 3, 1],
			[4, 5, 1],
			[1, 6, 1],
		],
		route: [
			[3, 0],
			[1, 2],
			[3, 4],
			[5, 6],
		],
		goal: { captures: 3 },
		hint: "Take three dark men. After the first landing, the light king must jump backward.",
		explanation:
			"13x6x15x24 uses both directions. The remaining dark man on square 8 is not part of this chain.",
	}),
	puzzle({
		id: "promotion-01",
		title: "The final step",
		category: "promotion",
		difficulty: "beginner",
		pieces: [
			[6, 3, 1],
			[0, 1, 4],
		],
		route: [
			[6, 3],
			[7, 4],
		],
		otherRoutes: [
			[
				[6, 3],
				[7, 2],
			],
		],
		goal: { promotes: true, captures: 0 },
		hint: "Reach the far edge with the dark man. Either empty diagonal landing crowns it.",
		explanation:
			"26-31 and 26-30 both promote the man. Crowning happens immediately when the complete turn finishes.",
	}),
	puzzle({
		id: "promotion-02",
		title: "Crown, then stop",
		category: "promotion",
		difficulty: "intermediate",
		pieces: [
			[5, 0, 1],
			[6, 1, 3],
			[6, 3, 3],
		],
		route: [
			[5, 0],
			[7, 2],
		],
		goal: { promotes: true, captures: 1 },
		hint: "Jump onto the last row. The tempting backward capture belongs to a later turn.",
		explanation:
			"21x30 crowns the man and ends the turn. It must not immediately continue as a king over the man on square 26.",
	}),
	puzzle({
		id: "promotion-03",
		title: "Light reaches the top",
		category: "promotion",
		difficulty: "intermediate",
		side: "light",
		pieces: [
			[4, 7, 3],
			[3, 6, 1],
			[1, 4, 1],
			[7, 0, 2],
		],
		route: [
			[4, 7],
			[2, 5],
			[0, 3],
		],
		goal: { promotes: true, captures: 2 },
		hint: "Take two dark men on the way to the upper crown row.",
		explanation:
			"20x11x2 captures two men and crowns light. Each side promotes on the edge opposite its starting rows.",
	}),
	puzzle({
		id: "promotion-04",
		title: "Pass the backward temptation",
		category: "promotion",
		difficulty: "intermediate",
		pieces: [
			[3, 0, 1],
			[4, 1, 3],
			[4, 3, 4],
			[6, 3, 3],
		],
		route: [
			[3, 0],
			[5, 2],
			[7, 4],
		],
		goal: { promotes: true, captures: 2 },
		hint: "Keep the man moving forward. The king behind the intermediate landing cannot be taken by a backward jump.",
		explanation:
			"13x22x31 takes two men and promotes. The light king on square 18 remains because dark was still a man when it passed that square.",
	}),
	puzzle({
		id: "promotion-05",
		title: "The long road to a crown",
		category: "promotion",
		difficulty: "advanced",
		pieces: [
			[1, 6, 1],
			[2, 1, 1],
			[2, 5, 3],
			[4, 3, 3],
			[6, 1, 3],
			[7, 6, 3],
		],
		route: [
			[1, 6],
			[3, 4],
			[5, 2],
			[7, 0],
		],
		goal: { promotes: true, captures: 3 },
		hint: "The man on square 8 has a three-jump path to the far-left crown square.",
		explanation:
			"8x15x22x29 captures three men before promotion. It is one turn, even though the piece crosses almost the whole board.",
	}),
	puzzle({
		id: "promotion-06",
		title: "Trade up to a crown",
		category: "promotion",
		difficulty: "beginner",
		side: "light",
		pieces: [
			[2, 1, 3],
			[1, 2, 2],
			[5, 6, 4],
			[4, 7, 2],
		],
		route: [
			[2, 1],
			[0, 3],
		],
		goal: { promotes: true, captures: 1 },
		hint: "The light man can take a king and become a king in the same turn.",
		explanation:
			"9x2 removes the dark king on square 6 and crowns light. A captured king is removed exactly like a captured man.",
	}),
	puzzle({
		id: "tactics-01",
		title: "Close the corner",
		category: "tactics",
		difficulty: "beginner",
		pieces: [
			[1, 2, 2],
			[1, 0, 3],
			[4, 7, 1],
		],
		route: [
			[1, 2],
			[0, 1],
		],
		goal: { outcome: { winner: "dark", reason: "blocked" } },
		hint: "Win this turn without capturing. Occupy the light man’s only forward square.",
		explanation:
			"6-1 leaves light with no legal move. The board edge prevents a jump over the blocking king.",
	}),
	puzzle({
		id: "tactics-02",
		title: "Count beyond the fork",
		category: "tactics",
		difficulty: "advanced",
		pieces: [
			[4, 3, 2],
			[3, 2, 3],
			[1, 2, 3],
			[1, 4, 3],
			[5, 4, 3],
		],
		route: [
			[4, 3],
			[2, 1],
			[0, 3],
			[2, 5],
		],
		goal: { captures: 3 },
		hint: "One branch takes a single man; the other takes three. Begin by jumping backward.",
		explanation:
			"18x9x2x11 takes three men. The forward route 18x27 takes only one, although it is also legal.",
	}),
	puzzle({
		id: "tactics-03",
		title: "Choose the working piece",
		category: "tactics",
		difficulty: "intermediate",
		pieces: [
			[0, 1, 1],
			[4, 5, 2],
			[1, 2, 3],
			[3, 2, 3],
			[5, 6, 3],
		],
		route: [
			[0, 1],
			[2, 3],
			[4, 1],
		],
		goal: { captures: 2 },
		hint: "Both your man and king can capture. Choose the piece that can take two opponents.",
		explanation:
			"The man plays 1x10x17 for two captures. The king can take only one with 19x28; a crown does not always have the more productive turn.",
	}),
	puzzle({
		id: "tactics-04",
		title: "Seal the pocket",
		category: "tactics",
		difficulty: "intermediate",
		pieces: [
			[0, 1, 2],
			[2, 3, 1],
			[1, 4, 2],
			[1, 2, 3],
		],
		route: [
			[1, 4],
			[0, 3],
		],
		goal: { outcome: { winner: "dark", reason: "blocked" } },
		hint: "One king already covers a forward square. Use the other king to cover the second.",
		explanation:
			"7-2 blocks light’s last empty forward square. The friendly dark man initially prevents 1x10, so the winning quiet move is legal.",
	}),
	puzzle({
		id: "tactics-05",
		title: "Remove the last defenders",
		category: "tactics",
		difficulty: "beginner",
		pieces: [
			[6, 7, 2],
			[0, 1, 1],
			[5, 6, 3],
			[3, 6, 3],
		],
		route: [
			[6, 7],
			[4, 5],
			[2, 7],
		],
		goal: { captures: 2, outcome: { winner: "dark", reason: "capture" } },
		hint: "Your king can take both remaining light men. Follow the right-edge zigzag.",
		explanation:
			"28x19x12 removes the last two light pieces. Elimination ends the game immediately, regardless of how many turns have been played.",
	}),
	puzzle({
		id: "tactics-06",
		title: "Avoid the immediate trap",
		category: "tactics",
		difficulty: "intermediate",
		pieces: [
			[0, 1, 2],
			[2, 3, 4],
		],
		route: [
			[0, 1],
			[1, 0],
		],
		goal: { captures: 0, safe: true, destination: 4 },
		hint: "Only one landing keeps your king off the opponent’s next capture. Check both choices.",
		explanation:
			"1-5 avoids an immediate capture. After 1-6 instead, light could play 10x1 and remove your last piece. This puzzle establishes safety for the next turn, not a forced win.",
	}),
];
