import { createState, notation, type GameState } from "../core/engine";
import { validateMatch, type Match } from "../core/match";

export const exportJSON = (match: Match): string =>
	JSON.stringify(match, null, 2);
export function importJSON(text: string): Match {
	if (text.length > 5_000_000)
		throw new Error(
			"This file is too large. Choose an Astra game smaller than 5 MB.",
		);
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		throw new Error("This file is not valid JSON.");
	}
	return validateMatch(parsed);
}
export function exportPDN(match: Match): string {
	if (!match.config.mandatoryCapture)
		throw new Error(
			"PDN export supports standard rules. Use JSON for optional-capture games.",
		);
	const result = !match.outcome
		? "*"
		: !match.outcome.winner
			? "1/2-1/2"
			: match.outcome.winner === "dark"
				? "1-0"
				: "0-1";
	const pieces = (side: "dark" | "light") =>
		match.initial.board
			.flatMap((piece, i) =>
				(
					side === "dark"
						? piece === 1 || piece === 2
						: piece === 3 || piece === 4
				)
					? `${piece === 2 || piece === 4 ? "K" : ""}${i + 1}`
					: [],
			)
			.join(",");
	const headers = [
		'[Event "Astra Checkers"]',
		'[GameType "21"]',
		`[Date "${new Date(match.createdAt).toISOString().slice(0, 10).replaceAll("-", ".")}"]`,
		`[Black "${match.config.mode === "local" || match.config.humanSide === "dark" ? "Player" : "Astra"}"]`,
		`[White "${match.config.mode === "local" || match.config.humanSide === "light" ? "Player" : "Astra"}"]`,
		`[Result "${result}"]`,
		'[SetUp "1"]',
		`[FEN "${match.initial.turn === "dark" ? "B" : "W"}:W${pieces("light")}:B${pieces("dark")}"]`,
	];
	let side = match.initial.turn;
	let moveNumber = 1;
	const moves = match.history.map((entry) => {
		const prefix =
			side === "dark"
				? `${moveNumber}. `
				: moveNumber === 1 && match.initial.turn === "light"
					? "1... "
					: "";
		if (side === "light") moveNumber++;
		side = side === "dark" ? "light" : "dark";
		return prefix + notation(entry.turn);
	});
	return `${headers.join("\n")}\n\n${moves.join(" ")} ${result}\n`;
}
export function positionLink(state: GameState): string {
	const valid = createState(state.board, state.turn, state.rules);
	const url = new URL(location.href);
	url.hash = `position=${btoa(JSON.stringify({ b: valid.board, t: valid.turn, m: valid.rules.mandatoryCapture }))}`;
	return url.href;
}
export function readPositionLink(hash: string): GameState | null {
	if (!hash.startsWith("#position=")) return null;
	if (hash.length > 4096) throw new Error("This position link is too long.");
	try {
		const value = JSON.parse(atob(decodeURIComponent(hash.slice(10))));
		if (typeof value.m !== "boolean" || !["dark", "light"].includes(value.t))
			throw new Error("Invalid position settings");
		return createState(value.b, value.t, { mandatoryCapture: value.m });
	} catch {
		throw new Error("This position link is invalid.");
	}
}
