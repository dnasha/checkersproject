import "./styles.css";
import {
	createInitialState,
	createState,
	getLegalTurns,
	getOutcome,
	getCoords,
	getSquare,
	sideOf,
	isKing,
	opponent,
	sameTurn,
	notation,
} from "./core/engine";
import type { GameState, Side, Turn } from "./core/engine";
import {
	newMatch,
	settleClock,
	commitTurn,
	pauseMatch,
	resumeMatch,
	undoMatch,
	finishMatch,
	canUndo,
	now,
} from "./core/match";
import type { Match, MatchConfig, Mode, TimeControl } from "./core/match";
import {
	loadPreferences,
	savePreferences,
	saveMatch,
	getMatches,
	getActiveMatch,
	deleteMatch,
	setActiveMatch,
	getProgress,
	markProgress,
} from "./services/storage";
import { playSound } from "./services/sound";
import {
	exportJSON,
	importJSON,
	exportPDN,
	positionLink,
	readPositionLink,
} from "./services/sharing";
import { lessons, puzzles } from "./content/learning";
import type { Lesson, Puzzle } from "./content/learning";
import type {
	Difficulty,
	SearchPurpose,
	WorkerResult,
	SearchRequest,
} from "./ai/protocol";
import { searchBudget } from "./ai/protocol";

const root = document.querySelector<HTMLDivElement>("#app")!;
const notices = document.createElement("div");
notices.innerHTML =
	'<div class="toast" id="toast" role="status"></div><div class="sr-only" id="announcer" role="status" aria-live="polite" aria-atomic="true"></div>';
document.body.append(notices);
const esc = (value: unknown): string =>
	String(value ?? "").replace(
		/[&<>"']/g,
		(c) =>
			({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
				c
			]!,
	);
const paths: Record<string, string> = {
	arrow: "M5 12h14m-6-6 6 6-6 6",
	crown: "m3 6 4 4 5-7 5 7 4-4-2 13H5L3 6Zm3 9h12",
	sun: "M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 1.5 1.5m9.8 9.8 1.5 1.5M5.6 18.4l1.5-1.5m9.8-9.8 1.5-1.5M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
	chevron: "m9 5 7 7-7 7",
	undo: "M9 4 3 10l6 6M3 10h11a7 7 0 0 1 0 14",
	flip: "M7 3 3 7l4 4M3 7h13a5 5 0 0 1 5 5M17 21l4-4-4-4m4 4H8a5 5 0 0 1-5-5",
	book: "M12 5C8 2 4 3 2 4v15c4-2 7-1 10 1m0-15c4-3 8-2 10-1v15c-4-2-7-1-10 1V5",
	spark: "m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z",
	people:
		"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.9M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0m4-3.9a4 4 0 0 1 0 7.8",
	settings: "M4 7h16M4 17h16M8 4v6m8 4v6",
	pause: "M8 4v16M16 4v16",
	play: "m7 3 15 9-15 9V3Z",
	flag: "M4 22V3c6-5 10 5 16 0v12c-6 5-10-5-16 0",
	download: "M12 3v12m-5-5 5 5 5-5M3 16v5h18v-5",
	share: "M15 3h6v6m-1-5L10 14M11 5H3v16h16v-8",
	close: "m5 5 14 14M5 19 19 5",
	check: "m4 12 5 5L20 6",
	sound: "M11 3 6 8H2v8h4l5 5V3Zm5 4a7 7 0 0 1 0 10m3-13a11 11 0 0 1 0 16",
	clock: "M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
	grid: "M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm11 0h7v7h-7v-7Z",
};
function icon(name: string): string {
	return `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${(
		paths[name] || paths.spark
	)
		.split("|")
		.map((d) => `<path d="${d}"/>`)
		.join("")}</svg>`;
}
function button(
	action: string,
	label: string,
	cls = "button",
	symbol?: string,
	attrs = "",
): string {
	return `<button type="button" class="${cls}" data-action="${action}" ${attrs}>${symbol ? icon(symbol) : ""}${label}</button>`;
}

let preferences = loadPreferences();
let config: MatchConfig = {
	mode: "practice",
	difficulty: "challenging",
	humanSide: "dark",
	mandatoryCapture: true,
	timeControl: "off",
};
let view: "home" | "play" | "learn" | "library" | "editor" = "home";
let live: Match | null = null;
let sandbox: Match | null = null;
let selected: number | null = null;
let focusedSquare = 20;
let flipped = true;
let review: number | null = null;
let revision = 0;
let requestId = 0;
let pendingRequest: SearchRequest | null = null;
let worker: Worker | null = null;
let workerFailure = false;
let analysis: WorkerResult | null = null;
let hintTurn: Turn | null = null;
let library: Match[] = [];
let libraryLoadVersion = 0;
let progress: Record<string, boolean> = {};
let exercise: {
	item: Lesson | Puzzle;
	type: "lesson" | "puzzle";
	match: Match;
	step: number;
	solved: boolean;
	message: string;
} | null = null;
let editorBoard = Array<number>(32).fill(0);
let editorTurn: Side = "dark";
let editorPiece = 1;
let editorRules = true;
let updateAvailable = false;
let statusMessage = "";
let toastTimer: ReturnType<typeof setTimeout>;
let lastAnnounced = "";
let dialogOpener: string | null = null;
const paletteNames = [
	"wood",
	"classic",
	"ice",
	"beach",
	"forest",
	"pink",
	"ukraine",
] as const;
const modeNames: Record<Mode, string> = {
	practice: "Practice",
	challenge: "Challenge",
	local: "Local",
};

function active(): Match | null {
	return exercise?.match ?? sandbox ?? live;
}
function displayState(): GameState {
	const match = active();
	if (!match) return createInitialState();
	return review === null
		? match.state
		: review < 0
			? match.initial
			: match.history[review].state;
}
function cancelSearch(): void {
	worker?.postMessage({ type: "stop" });
	pendingRequest = null;
}
function changed(): void {
	revision++;
	cancelSearch();
	analysis = null;
	hintTurn = null;
}
function notify(message: string): void {
	const toast = document.querySelector<HTMLElement>("#toast");
	if (!toast) return;
	toast.textContent = message;
	toast.classList.add("visible");
	clearTimeout(toastTimer);
	toastTimer = setTimeout(() => toast.classList.remove("visible"), 5500);
}
function announce(message: string): void {
	if (message === lastAnnounced) return;
	lastAnnounced = message;
	const region = document.querySelector<HTMLElement>("#announcer");
	if (region) region.textContent = message;
}
function persist(): void {
	for (const match of [live, sandbox])
		if (match)
			void saveMatch(match).catch(() =>
				notify(
					"Your browser could not save this game. You can still play and export it.",
				),
			);
}
function setMatch(match: Match): void {
	match = { ...match, updatedAt: now() };
	if (exercise) exercise.match = match;
	else if (sandbox) {
		sandbox = match;
		persist();
	} else {
		live = match;
		persist();
	}
}
function focusSelector(element: HTMLElement | null): string | null {
	if (!element || element === document.body) return null;
	if (element.id) return `#${CSS.escape(element.id)}`;
	for (const key of [
		"square",
		"action",
		"mode",
		"lesson",
		"puzzle",
		"review",
		"editorPiece",
		"editorSquare",
	]) {
		if (element.dataset[key] !== undefined)
			return `[data-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}="${CSS.escape(element.dataset[key]!)}"]`;
	}
	if (element instanceof HTMLAnchorElement && element.getAttribute("href"))
		return `[href="${CSS.escape(element.getAttribute("href")!)}"]`;
	if (element.getAttribute("name"))
		return `[name="${CSS.escape(element.getAttribute("name")!)}"]`;
	return null;
}
function restoreFocus(selector: string | null): void {
	if (selector)
		document
			.querySelector<HTMLElement>(selector)
			?.focus({ preventScroll: true });
}
function canAnalyze(): boolean {
	const match = active();
	return (
		!!match &&
		!match.clock.paused &&
		!match.pending &&
		(match.outcome !== null ||
			match.config.mode === "local" ||
			(match.config.mode === "practice" &&
				match.state.turn === match.config.humanSide))
	);
}
function linkedPosition(): GameState | null {
	try {
		return readPositionLink(location.hash);
	} catch {
		statusMessage =
			"This position link is invalid. Create a new position in the editor.";
		return null;
	}
}
function capital(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1);
}
function timeLabel(ms: number): string {
	const sec = Math.max(0, Math.ceil(ms / 1000));
	return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}
function playerName(side: Side, match: Match): string {
	return match.config.mode === "local"
		? `${capital(side)} pieces`
		: side === match.config.humanSide
			? "You"
			: `Computer · ${capital(match.config.difficulty)}`;
}
function outcomeText(match: Match): string {
	if (!match.outcome) return "";
	const reason = {
		capture: "All opposing pieces captured.",
		blocked: "No legal moves remain.",
		repetition: "The position repeated three times.",
		"no-progress": "80 turns without a capture or man moving.",
		resignation: "A player resigned.",
		timeout: "The clock ran out.",
		agreement: "Both players agreed to a draw.",
	}[match.outcome.reason];
	return `${match.outcome.winner ? `${capital(match.outcome.winner)} wins` : "Game drawn"}. ${reason}`;
}
function canPlay(): boolean {
	const match = active();
	return (
		!!match &&
		!match.outcome &&
		!match.clock.paused &&
		review === null &&
		!exercise?.solved &&
		(exercise !== null ||
			match.config.mode === "local" ||
			match.state.turn === match.config.humanSide)
	);
}
function legalTurns(): Turn[] {
	const match = active();
	if (!match) return [];
	let turns = getLegalTurns(match.state);
	if (match.pending) {
		const pending = match.pending;
		turns = turns.filter(
			(t) =>
				t.from === pending.from &&
				pending.path.every((p, i) => t.path[i] === p),
		);
	}
	return turns;
}
function availableDestinations(): number[] {
	const match = active();
	if (selected === null || !match || !canPlay()) return [];
	return legalTurns()
		.filter((t) => t.from === selected)
		.map((t) => t.path[match.pending?.path.length ?? 0]);
}
function boardForDisplay(): number[] {
	const state = displayState();
	const board = [...state.board];
	const match = active();
	if (review === null && match?.pending) {
		const turn = legalTurns()[0];
		if (turn) {
			const piece = board[turn.from];
			board[turn.from] = 0;
			match.pending.path.forEach((_, index) => {
				board[turn.captures[index]] = 0;
			});
			board[match.pending.path.at(-1)!] = piece;
		}
	}
	return board;
}
function pieceMarkup(piece: number): string {
	return piece
		? `<span class="piece ${sideOf(piece)} ${isKing(piece) ? "king" : ""}" aria-hidden="true"><span class="piece-ring">${isKing(piece) ? icon("crown") : '<span class="piece-center"></span>'}</span></span>`
		: "";
}

function boardMarkup(
	board: number[],
	interactive = true,
	preview = false,
): string {
	const destinations =
		preview || view === "editor" ? [] : availableDestinations();
	const match = active();
	const lastTurn =
		preview || view === "editor"
			? null
			: review !== null
				? review < 0
					? null
					: match?.history[review].turn
				: match?.history.at(-1)?.turn;
	const pendingSquare = match?.pending?.path.at(-1);
	const legalStarts =
		interactive && canPlay()
			? new Set(legalTurns().map((t) => t.from))
			: new Set<number>();
	const useFlip = preview ? true : flipped;
	let rows = "";
	for (let displayRow = 0; displayRow < 8; displayRow++) {
		let cells = "";
		for (let displayCol = 0; displayCol < 8; displayCol++) {
			const row = useFlip ? 7 - displayRow : displayRow;
			const col = useFlip ? 7 - displayCol : displayCol;
			const square = getSquare(row, col);
			if (square < 0) {
				cells +=
					'<div class="square pale" role="gridcell" aria-hidden="true"></div>';
				continue;
			}
			const piece = board[square];
			const label = `${square + 1}, ${piece ? `${sideOf(piece)} ${isKing(piece) ? "king" : "man"}` : "empty"}${destinations.includes(square) ? ", legal destination" : ""}${legalStarts.has(square) ? ", movable" : ""}`;
			const sel = (pendingSquare ?? selected) === square && !preview;
			const last =
				lastTurn?.from === square || lastTurn?.path.at(-1) === square;
			const hint =
				view !== "editor" &&
				hintTurn &&
				(hintTurn.from === square || hintTurn.path.includes(square));
			const cls = `square walnut${sel ? " selected" : ""}${destinations.includes(square) ? " destination" : ""}${last ? " last-move" : ""}${hint ? " hint-square" : ""}`;
			cells += interactive
				? `<div role="gridcell" aria-colindex="${displayCol + 1}" class="${cls}"><button type="button" data-square="${square}" class="square-hit" tabindex="${focusedSquare === square ? 0 : -1}" aria-label="${label}" aria-pressed="${sel}" ${canPlay() && piece && (legalStarts.has(square) || pendingSquare === square) ? 'draggable="true"' : ""}>${preferences.coordinates || exercise ? `<span class="square-number">${square + 1}</span>` : ""}${pieceMarkup(piece)}${destinations.includes(square) ? '<span class="destination-dot" aria-hidden="true"></span>' : ""}</button></div>`
				: `<div class="${cls}" role="gridcell" aria-label="${label}">${pieceMarkup(piece)}</div>`;
		}
		rows += `<div class="board-row" role="row" aria-rowindex="${displayRow + 1}">${cells}</div>`;
	}
	return `<div class="board-frame${preview ? " preview-board" : ""}"><div class="checkerboard" role="grid" aria-rowcount="8" aria-colcount="8" aria-label="${preview ? "Checkers board preview" : "Checkers board, arrow keys to navigate, Enter to select a piece or destination"}" ${preview ? 'aria-hidden="true"' : ""}>${rows}</div></div>`;
}

function header(): string {
	return `<header class="site-header"><a class="brand" href="#home" aria-label="Checkers home"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span>Checkers</span></a><nav aria-label="Main navigation"><a href="#home" ${view === "home" || view === "play" ? 'aria-current="page"' : ""}>Play</a><a href="#learn" ${view === "learn" ? 'aria-current="page"' : ""}>Learn</a><a href="#library" ${view === "library" ? 'aria-current="page"' : ""}>Library</a><a href="#editor" ${view === "editor" ? 'aria-current="page"' : ""}>Editor</a></nav><div class="header-tools"><span class="offline-tag" id="offline-status">${document.documentElement.dataset.offline === "ready" ? "<span></span>Offline ready" : ""}</span>${button("preferences", '<span class="sr-only">Settings</span>', "icon-button", "settings")}</div></header>`;
}
function homeMarkup(): string {
	const descriptions: Record<Mode, string> = {
		practice: "Hints, analysis and untimed undo",
		challenge: "No assistance during play",
		local: "Two players on this device",
	};
	return `<main class="home-page"><section class="start-section" aria-labelledby="start-heading">
    <h1 id="start-heading">New game</h1>
    ${live && !live.outcome ? `<div class="resume-strip"><span><strong>Current game</strong><small>${modeNames[live.config.mode]} · ${live.history.length} ${live.history.length === 1 ? "turn" : "turns"}${live.clock.paused ? " · Paused" : ""}</small></span>${button("resume-game", "Resume", "button secondary small")}</div>` : ""}
    <div class="mode-options">${(["practice", "challenge", "local"] as Mode[]).map((mode) => `<button type="button" class="mode-card ${config.mode === mode ? "active" : ""}" data-mode="${mode}" aria-pressed="${config.mode === mode}"><span><strong>${modeNames[mode]}</strong><small>${descriptions[mode]}</small></span><span class="radio-mark"></span></button>`).join("")}</div>
    <form id="setup-form" class="setup-panel"><div class="setup-fields">
      <label>Your pieces<select name="humanSide" ${config.mode === "local" ? "disabled" : ""}><option value="dark" ${config.humanSide === "dark" ? "selected" : ""}>Dark · first</option><option value="light" ${config.humanSide === "light" ? "selected" : ""}>Light · second</option></select></label>
      <label>Difficulty<select name="difficulty" ${config.mode === "local" ? "disabled" : ""}>${(["beginner", "casual", "challenging", "expert"] as Difficulty[]).map((level) => `<option ${level === config.difficulty ? "selected" : ""} value="${level}">${capital(level)}</option>`).join("")}</select></label>
      <label>Time control<select name="timeControl">${(["off", "3+3", "5+3", "10+5"] as TimeControl[]).map((time) => `<option value="${time}" ${time === config.timeControl ? "selected" : ""}>${time === "off" ? "Untimed" : `${time.split("+")[0]} min + ${time.split("+")[1]} sec`}</option>`).join("")}</select></label>
      <label>Rules<select name="mandatoryCapture"><option value="true" ${config.mandatoryCapture ? "selected" : ""}>Compulsory captures</option><option value="false" ${!config.mandatoryCapture ? "selected" : ""}>Optional captures</option></select></label>
    </div><button class="button primary start-button" type="submit">Start game</button></form>
  </section></main>`;
}

function playerCard(side: Side, match: Match): string {
	const count = match.state.board.filter(
		(piece) => sideOf(piece) === side,
	).length;
	const turn = side === match.state.turn && !match.outcome;
	return `<div class="player-card ${turn ? "current" : ""}"><div class="player-avatar">${pieceMarkup(side === "dark" ? 1 : 3)}</div><div class="player-info"><strong>${exercise ? `${capital(side)} pieces` : playerName(side, match)}</strong><span>${capital(side)} · ${count} ${count === 1 ? "piece" : "pieces"}${turn ? " · To move" : ""}</span></div>${match.config.timeControl !== "off" ? `<time class="clock" id="clock-${side}" aria-label="${capital(side)} time remaining">${timeLabel(match.clock.remaining[side])}</time>` : `<span class="player-status">${turn ? '<span class="turn-dot"></span>' : ""}</span>`}</div>`;
}
function gameStatus(match: Match): { title: string; detail: string } {
	if (exercise?.solved)
		return { title: "Solved", detail: exercise.item.explanation };
	if (match.outcome)
		return {
			title: match.outcome.winner
				? `${capital(match.outcome.winner)} wins.`
				: "Draw",
			detail: outcomeText(match).split(". ").slice(1).join(". "),
		};
	if (review !== null)
		return {
			title: "Replay",
			detail:
				review < 0
					? "The starting position."
					: `After turn ${review + 1}: ${notation(match.history[review].turn)}`,
		};
	if (match.clock.paused)
		return {
			title: "Paused",
			detail: "",
		};
	if (exercise)
		return {
			title: exercise.item.title,
			detail:
				"instruction" in exercise.item
					? exercise.item.instruction
					: exercise.item.hint,
		};
	if (match.pending)
		return {
			title: "Continue capture",
			detail: "Continue jumping with the same piece.",
		};
	if (!canPlay())
		return {
			title: "Computer thinking",
			detail: "",
		};
	const capture = getLegalTurns(match.state).some((t) => t.captures.length);
	return {
		title:
			match.config.mode === "local"
				? `${capital(match.state.turn)} to move.`
				: "Your move.",
		detail:
			capture && match.config.mandatoryCapture
				? "A capture is available. You must take it."
				: "Select a piece, then a destination.",
	};
}
function analysisMarkup(): string {
	const busy =
		pendingRequest?.purpose === "analysis" ||
		pendingRequest?.purpose === "hint";
	const controls = busy
		? `<div class="analysis-progress"><p class="muted">${pendingRequest?.purpose === "analysis" ? "Comparing candidate moves" : "Finding a useful hint"}${analysis ? ` · depth ${analysis.depth}` : "…"}</p>${button("play-now", "Show result now", "button secondary small")}</div>`
		: "";
	if (!analysis) return controls;
	const advantage =
		Math.abs(analysis.score) < 20
			? "Estimated: balanced"
			: `Estimated advantage: ${analysis.score > 0 ? "Dark" : "Light"}`;
	const alternatives = analysis.alternatives?.length
		? `<div class="analysis-alternatives"><p class="eyebrow">CANDIDATE MOVES</p>${analysis.alternatives.map((alternative, i) => `<div class="alternative"><div><strong>${i + 1}. ${notation(alternative.move)}</strong><span>${alternative.score > 0 ? "+" : ""}${(alternative.score / 100).toFixed(2)}</span></div><p>${alternative.pv.slice(0, 5).map(notation).join(" → ")}</p></div>`).join("")}</div>`
		: "";
	return `${controls}<div class="analysis-score"><strong>${advantage}</strong><span>${analysis.score > 0 ? "+" : ""}${(analysis.score / 100).toFixed(2)}</span></div><p class="analysis-line">${analysis.pv.length ? `Line: ${analysis.pv.slice(0, 6).map(notation).join(" → ")}` : "No continuation available."}</p>${analysis.move && (analysis.move.captures.length || analysis.move.promotion) ? `<p class="tactical-fact">${analysis.move.captures.length ? `Captures ${analysis.move.captures.length} ${analysis.move.captures.length === 1 ? "piece" : "pieces"}.` : ""}${analysis.move.promotion ? " Promotes to king." : ""}</p>` : ""}${alternatives}<details class="diagnostics"><summary>Search details</summary><p>Depth ${analysis.depth} · ${analysis.nodes.toLocaleString()} nodes · ${Math.round(analysis.elapsedMs)} ms</p><p>Scores are estimates from Dark’s perspective.</p></details>`;
}
function historyMarkup(match: Match): string {
	const pairs: string[] = [];
	for (let i = 0; i < match.history.length; i += 2)
		pairs.push(
			`<div class="move-row"><span>${Math.floor(i / 2) + 1}.</span>${[i, i + 1].map((index) => (match.history[index] ? `<button type="button" data-review="${index}" class="move-entry ${review === index || (review === null && index === match.history.length - 1) ? "current" : ""}" aria-label="Review turn ${index + 1}: ${notation(match.history[index].turn)}">${notation(match.history[index].turn)}</button>` : "<span></span>")).join("")}</div>`,
		);
	return `<div class="move-list" aria-label="Move history">${pairs.length ? pairs.join("") : '<div class="empty-moves">No moves yet.</div>'}</div>`;
}
function graphMarkup(match: Match): string {
	const points = match.history.map((entry, i) => ({
		x: 5 + (i * 290) / Math.max(1, match.history.length - 1),
		y: 35 - (Math.max(-500, Math.min(500, entry.evaluation ?? 0)) / 500) * 27,
	}));
	return `<svg class="advantage-graph" viewBox="0 0 300 70" role="img" aria-label="Recorded estimated advantage by turn, positive values favor dark; unanalyzed turns shown at the center"><path d="M5 35H295" stroke="var(--line)" stroke-dasharray="3 3"/>${points.length ? `<polyline points="${points.map((p) => `${p.x},${p.y}`).join(" ")}" fill="none" stroke="var(--accent)" stroke-width="2"/>` : ""}<text x="5" y="12">Dark</text><text x="5" y="66">Light</text></svg>`;
}
function playMarkup(): string {
	const match = active();
	if (!match) return homeMarkup();
	const status = gameStatus(match);
	const assistance =
		!!exercise || match.config.mode !== "challenge" || !!match.outcome;
	const topSide = flipped ? "light" : "dark";
	const bottomSide = opponent(topSide);
	const legal = legalTurns();
	return `<main class="play-page"><div class="play-heading"><div><h1>${exercise ? capital(exercise.type) : modeNames[match.config.mode]}</h1>${!match.config.mandatoryCapture ? '<p class="match-rules">Optional captures</p>' : ""}</div>${button(exercise ? "exit-exercise" : "new-game", exercise ? "Back to learning" : "New game", "button secondary small", exercise ? "book" : "grid")}</div><div class="game-layout"><section class="board-column" aria-label="Game board">${playerCard(topSide, match)}<div class="board-container ${match.clock.paused ? "is-paused" : ""}">${boardMarkup(boardForDisplay())}${match.clock.paused ? `<div class="pause-overlay">${icon("pause")}<h2>Game paused</h2>${button("pause", "Resume", "button primary", "play")}</div>` : ""}</div>${playerCard(bottomSide, match)}<div class="board-toolbar">${button("flip", "Flip board", "quiet-button", "flip")}${button("sound", preferences.sound ? "Sound on" : "Sound off", "quiet-button", "sound")}${!exercise && !match.outcome ? button("pause", match.clock.paused ? "Resume" : "Pause", "quiet-button", match.clock.paused ? "play" : "pause") : ""}</div><details class="accessible-moves"><summary>Play using a list of legal moves</summary><form id="legal-form"><label for="legal-select">Legal turn</label><select id="legal-select" name="turn" ${!canPlay() ? "disabled" : ""}>${legal.map((turn, i) => `<option value="${i}">${notation(turn)}${turn.captures.length ? ` · captures ${turn.captures.length}` : ""}${turn.promotion ? " · becomes king" : ""}</option>`).join("")}</select><button type="submit" class="button secondary small" ${!canPlay() ? "disabled" : ""}>Play turn</button></form><p>Arrow keys navigate the board. Enter or Space selects; Escape clears selection. Finish all jumps once a capture begins.</p></details></section><aside class="game-sidebar"><section class="status-card"><h2>${status.title}</h2>${status.detail ? `<p id="turn-detail">${esc(status.detail)}</p>` : ""}${exercise?.message ? `<p class="exercise-message">${esc(exercise.message)}</p>` : ""}${exercise?.solved ? button("next-exercise", "Next", "button primary", "arrow") : ""}${!canPlay() && !exercise && !match.outcome && !match.clock.paused && review === null ? `<div class="thinking-indicator"><span></span><span></span><span></span><small id="search-progress">Searching…</small></div>${button("play-now", "Play now", "button secondary small")}` : ""}${workerFailure ? button("retry-worker", "Retry computer opponent", "button secondary small") : ""}${match.outcome && !exercise ? `<div class="result-actions">${button("rematch", "Rematch", "button primary", "arrow")}${button("export-json", "Save a copy", "button secondary", "download")}</div>` : ""}</section>${assistance && !exercise?.solved ? `<section class="coach-card"><div class="coach-actions">${button("hint", "Hint", "button secondary small", "spark", (!canPlay() && review === null) || (!canAnalyze() && !exercise) ? "disabled" : "")}${button("analyze", "Analyze", "button secondary small", "grid", !canAnalyze() ? "disabled" : "")}${button("undo", "Undo", "button secondary small", "undo", !canUndo(match) || !!exercise || review !== null ? "disabled" : "")}</div><div id="analysis-content">${analysisMarkup()}</div></section>` : ""}<section class="history-card"><div class="card-title"><span>Moves</span><small>${match.history.length} ${match.history.length === 1 ? "turn" : "turns"}</small></div>${historyMarkup(match)}<div class="replay-controls">${button("review-first", '<span class="sr-only">Starting position</span>↤', "icon-button", undefined, !match.history.length || !!exercise ? "disabled" : "")}${button("review-prev", '<span class="sr-only">Previous turn</span>←', "icon-button", undefined, !match.history.length || !!exercise ? "disabled" : "")}<span>${review === null ? "Live board" : review < 0 ? "Start" : `${review + 1} / ${match.history.length}`}</span>${button("review-next", '<span class="sr-only">Next turn</span>→', "icon-button", undefined, !match.history.length || !!exercise ? "disabled" : "")}${button("review-live", '<span class="sr-only">Return to live board</span>⇥', "icon-button", undefined, !match.history.length || !!exercise ? "disabled" : "")}</div>${assistance && match.history.length ? graphMarkup(match) : ""}${review !== null && assistance ? button("continue-position", "Practice from this position", "text-button", "arrow") : ""}</section>${!exercise ? `<div class="game-actions">${button("share-position", "Share position", "quiet-button", "share")}${button("export-pdn", "Export PDN", "quiet-button", "download")}${button("export-json", "Save JSON", "quiet-button", "download")}${!match.outcome ? `${button("resign", "Resign", "quiet-button", "flag")}${match.config.mode === "local" ? button("draw", "Agree to draw", "quiet-button") : ""}` : ""}</div>` : ""}</aside></div></main>`;
}

function learnMarkup(): string {
	return `<main class="collection-page"><div class="page-intro"><h1>Learn</h1></div>
    <section><div class="section-heading"><h2>Lessons</h2><span class="count-label">${lessons.filter((item) => progress[item.id]).length} / ${lessons.length} completed</span></div>
      <div class="lesson-grid">${lessons.map((item, index) => `<button class="lesson-card" data-lesson="${index}"><div class="lesson-heading"><span class="lesson-number">${index + 1}</span><h3>${esc(item.title)}</h3>${progress[item.id] ? '<span class="completion-label">Completed</span>' : ""}</div><p>${esc(item.description)}</p></button>`).join("")}</div>
    </section>
    <section class="puzzle-section"><div class="section-heading"><h2>Puzzles</h2><span class="count-label">${puzzles.filter((item) => progress[item.id]).length} / ${puzzles.length} solved</span></div>
      <div class="puzzle-grid">${puzzles.map((item, index) => `<button class="puzzle-card" data-puzzle="${index}"><span><small>${esc(capital(item.category))} · ${esc(item.difficulty)}</small><strong>${esc(item.title)}</strong></span>${progress[item.id] ? '<span class="completion-label">Solved</span>' : icon("chevron")}</button>`).join("")}</div>
    </section>
  </main>`;
}
function libraryMarkup(): string {
	return `<main class="collection-page"><div class="page-intro compact"><h1>Library</h1><p>Games saved on this device.</p></div><div class="section-heading"><h2>Saved games</h2>${button("import", "Import JSON", "button secondary", "download")}</div>
    ${library.length ? `<div class="library-grid">${library.map((match) => `<article class="saved-game"><div class="saved-game-header"><span>${modeNames[match.config.mode]}</span><span>${new Date(match.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span></div><h3>${match.outcome ? (match.outcome.winner ? `${capital(match.outcome.winner)} wins` : "Draw") : "In progress"}</h3><p>${match.history.length} ${match.history.length === 1 ? "turn" : "turns"} · ${match.config.timeControl === "off" ? "Untimed" : match.config.timeControl} · ${match.config.mandatoryCapture ? "Compulsory captures" : "Optional captures"}</p><div>${button(`load:${match.id}`, match.outcome ? "Review" : "Resume", "button secondary small")}${button(`delete:${match.id}`, "Delete", "text-button")}</div></article>`).join("")}</div>` : '<div class="empty-library"><p>No saved games.</p><a href="#home" class="button primary">New game</a></div>'}
    <input type="file" id="import-file" accept="application/json,.json" hidden>
  </main>`;
}

function editorMarkup(): string {
	const count = editorBoard.filter(Boolean).length;
	const state = createState(editorBoard, editorTurn, {
		mandatoryCapture: editorRules,
	});
	return `<main class="play-page"><div class="play-heading"><div><h1>Position editor</h1></div>${button("editor-clear", "Clear board", "button secondary small")}</div><div class="game-layout"><section><div class="editor-board" id="editor-board">${boardMarkup(editorBoard, false)}</div><p class="editor-help">Select a piece below, then select a dark square to place it. Choose the eraser to remove a piece.</p><div class="piece-palette" role="group" aria-label="Piece to place">${[1, 2, 3, 4, 0].map((piece) => `<button type="button" data-editor-piece="${piece}" class="palette-piece ${editorPiece === piece ? "active" : ""}" aria-pressed="${editorPiece === piece}" aria-label="${piece ? `${sideOf(piece)} ${isKing(piece) ? "king" : "man"}` : "Eraser"}">${piece ? pieceMarkup(piece) : icon("close")}</button>`).join("")}</div></section><aside class="game-sidebar"><section class="status-card"><h2>Position</h2><label class="field-label">SIDE TO MOVE<select id="editor-turn"><option value="dark" ${editorTurn === "dark" ? "selected" : ""}>Dark</option><option value="light" ${editorTurn === "light" ? "selected" : ""}>Light</option></select></label><label class="checkbox-label"><input type="checkbox" id="editor-rules" ${editorRules ? "checked" : ""}>Captures are compulsory</label><p class="muted">${count} pieces · ${getLegalTurns(state).length} legal turns</p><div class="stack-actions">${button("editor-practice", "Practice this position", "button primary", "arrow")}${button("editor-analyze", "Analyze this position", "button secondary", "spark")}${button("editor-share", "Share position", "button secondary", "share")}${button("editor-starting", "Use starting position", "text-button")}</div></section><p class="editor-guidance">Dark moves toward squares 29–32; Light toward 1–4. Men reaching the last row become kings.</p></aside></div></main>`;
}

function render(): void {
	const focused = focusSelector(document.activeElement as HTMLElement | null);
	document.documentElement.dataset.matchActive =
		live && !live.outcome ? "true" : "false";
	document.documentElement.dataset.appearance = preferences.appearance;
	document.documentElement.dataset.palette = preferences.palette;
	root.innerHTML = `${header()}${view === "home" ? homeMarkup() : view === "play" ? playMarkup() : view === "learn" ? learnMarkup() : view === "library" ? libraryMarkup() : editorMarkup()}<dialog id="app-dialog" class="app-dialog" aria-labelledby="dialog-title"></dialog>`;
	if (view === "editor") wireEditor();
	restoreFocus(focused);
	if (view === "play" && active())
		announce(gameStatus(active()!).title + " " + gameStatus(active()!).detail);
	if (statusMessage) {
		notify(statusMessage);
		statusMessage = "";
	}
	if (updateAvailable && !live?.outcome && view === "home")
		notify("An update is ready. Finish your game, then reload to update.");
}
function loadLibrary(): void {
	const version = ++libraryLoadVersion;
	void getMatches()
		.then((matches) => {
			if (version !== libraryLoadVersion || view !== "library") return;
			library = matches;
			render();
		})
		.catch(() => {
			if (version === libraryLoadVersion && view === "library")
				notify("Your game library is temporarily unavailable.");
		});
}
function navigate(next: typeof view): void {
	changed();
	view = next;
	selected = null;
	review = null;
	exercise = null;
	sandbox = null;
	if (next !== "play") {
		persist();
	}
	render();
	window.scrollTo(0, 0);
	if (next === "library") loadLibrary();
	if (next === "play") maybeComputer();
}
function showDialog(title: string, contents: string): HTMLDialogElement {
	dialogOpener = focusSelector(document.activeElement as HTMLElement | null);
	const dialog = document.querySelector<HTMLDialogElement>("#app-dialog")!;
	dialog.innerHTML = `<div class="dialog-header"><h2 id="dialog-title">${title}</h2>${button("close-dialog", '<span class="sr-only">Close dialog</span>', "icon-button", "close")}</div>${contents}`;
	dialog.onclose = () => restoreFocus(dialogOpener);
	dialog.showModal();
	return dialog;
}
function preferencesDialog(): void {
	showDialog(
		"Settings",
		`<form id="preferences-form"><label class="field-label">APPEARANCE<select name="appearance">${["light", "dark", "contrast"].map((value) => `<option ${preferences.appearance === value ? "selected" : ""}>${value}</option>`).join("")}</select></label><label class="field-label">BOARD PALETTE<select name="palette">${paletteNames.map((value) => `<option value="${value}" ${preferences.palette === value ? "selected" : ""}>${capital(value)}</option>`).join("")}</select></label><label class="checkbox-label"><input type="checkbox" name="coordinates" ${preferences.coordinates ? "checked" : ""}>Show square numbers</label><label class="checkbox-label"><input type="checkbox" name="sound" ${preferences.sound ? "checked" : ""}>Move sounds</label><label class="checkbox-label"><input type="checkbox" name="ponder" ${preferences.ponder ? "checked" : ""}>Let Expert think during your turn</label><p class="muted small">Pondering uses extra battery. It stops when the page is hidden or you pause.</p><button type="submit" class="button primary">Save preferences ${icon("check")}</button></form>`,
	);
}
function confirmDialog(
	title: string,
	text: string,
	action: string,
	label: string,
): void {
	showDialog(
		title,
		`<p>${text}</p><div class="dialog-actions">${button("close-dialog", "Keep playing", "button secondary")}${button(action, label, "button primary")}</div>`,
	);
}
function startGame(initial?: GameState, temporary = false): void {
	changed();
	exercise = null;
	sandbox = null;
	const match = newMatch(config, initial);
	if (temporary) {
		sandbox = match;
		persist();
	} else {
		live = match;
		void setActiveMatch(match.id)
			.then(() => saveMatch(match))
			.catch(() =>
				notify(
					"Your browser could not save this game. Export a copy to keep it.",
				),
			);
	}
	selected = null;
	review = null;
	flipped = config.humanSide === "dark";
	focusedSquare = getLegalTurns(match.state)[0]?.from ?? 20;
	view = "play";
	history.replaceState(null, "", "#play");
	playSound("start", preferences.sound);
	render();
	window.scrollTo(0, 0);
	maybeComputer();
}
function reviewPosition(index: number | null): void {
	if (exercise) return;
	changed();
	review = index;
	selected = null;
	render();
	if (index === null) maybeComputer();
}
function playTurn(turn: Turn): void {
	let match = active();
	if (!match || !canPlay()) return;
	match = settleClock(match);
	if (match.outcome) {
		setMatch(match);
		render();
		return;
	}
	if (!legalTurns().some((legal) => sameTurn(legal, turn))) return;
	if (exercise) {
		const expected = exercise.item.solution[exercise.step];
		const alternatives =
			"alternatives" in exercise.item
				? (exercise.item.alternatives as Turn[][] | undefined)
				: undefined;
		if (
			!sameTurn(turn, expected) &&
			!(
				exercise.step === 0 &&
				alternatives?.some((line) => sameTurn(line[0], turn))
			)
		) {
			exercise.message = "Legal move, but it does not solve this exercise.";
			match = { ...match, pending: null };
			setMatch(match);
			selected = null;
			render();
			return;
		}
	}
	changed();
	match = commitTurn(match, turn);
	selected = null;
	setMatch(match);
	playSound(
		turn.promotion ? "king" : turn.captures.length ? "capture" : "move",
		preferences.sound,
	);
	if (exercise) {
		exercise.step++;
		exercise.message = "";
		if (exercise.step >= exercise.item.solution.length) {
			exercise.solved = true;
			progress[exercise.item.id] = true;
			void markProgress(exercise.item.id).catch(() => undefined);
			playSound("win", preferences.sound);
		} else {
			const reply = exercise.item.solution[exercise.step];
			if (
				reply &&
				sideOf(exercise.match.state.board[reply.from]) !==
					exercise.item.state.turn
			) {
				exercise.match = commitTurn(exercise.match, reply);
				exercise.step++;
			}
		}
	}
	render();
	if (match.outcome && !exercise) resultDialog();
	else maybeComputer();
}
function squareClick(square: number): void {
	if (!canPlay()) return;
	const match = active()!;
	const pending = match.pending;
	const prefix = pending?.path ?? [];
	if (selected !== null) {
		const candidates = legalTurns().filter(
			(turn) => turn.from === selected && turn.path[prefix.length] === square,
		);
		if (candidates.length) {
			const completed = candidates.find(
				(turn) => turn.path.length === prefix.length + 1,
			);
			if (completed) {
				playTurn(completed);
				return;
			}
			setMatch({
				...match,
				pending: { from: selected, path: [...prefix, square] },
			});
			focusedSquare = square;
			render();
			announce("Capture made. Continue jumping with the same piece.");
			return;
		}
	}
	if (pending) {
		notify("Finish the capture with the same piece.");
		return;
	}
	if (legalTurns().some((turn) => turn.from === square)) {
		selected = selected === square ? null : square;
		focusedSquare = square;
		render();
	} else if (sideOf(match.state.board[square]) === match.state.turn)
		notify(
			match.config.mandatoryCapture
				? "Choose a piece with a legal move. A capture takes priority."
				: "That piece has no legal move.",
		);
}

function setupWorker(): void {
	worker?.terminate();
	workerFailure = false;
	try {
		worker = new Worker(new URL("./ai/worker.ts", import.meta.url), {
			type: "module",
		});
	} catch {
		failedWorker("This browser could not create a background engine.");
		return;
	}
	worker.onmessage = (event: MessageEvent<WorkerResult>) => {
		const result = event.data;
		const request = pendingRequest;
		const match = active();
		if (
			!request ||
			!match ||
			result.id !== request.id ||
			result.sessionId !== match.id ||
			result.revision !== revision
		)
			return;
		if (result.type === "error") {
			failedWorker(result.message);
			return;
		}
		if (result.purpose !== "ponder") {
			analysis = result;
			const progressLabel = document.querySelector("#search-progress");
			if (progressLabel)
				progressLabel.textContent = `Looking ${result.depth} turns ahead`;
			if (result.purpose !== "move") {
				const target = document.querySelector("#analysis-content");
				if (target) {
					const focus = focusSelector(
						document.activeElement as HTMLElement | null,
					);
					target.innerHTML = analysisMarkup();
					restoreFocus(focus);
				}
			}
		}
		if (result.type !== "result") return;
		pendingRequest = null;
		if (result.purpose === "move") {
			if (
				view !== "play" ||
				review !== null ||
				match.clock.paused ||
				match.outcome ||
				document.hidden
			)
				return;
			const legal =
				result.move &&
				getLegalTurns(match.state).find((turn) => sameTurn(turn, result.move!));
			if (!legal) {
				failedWorker("The engine could not return a legal move.");
				return;
			}
			let next = commitTurn(settleClock(match), legal);
			if (next.history.length > match.history.length) {
				next = {
					...next,
					history: next.history.map((entry, i, list) =>
						i === list.length - 1
							? { ...entry, evaluation: result.score }
							: entry,
					),
				};
			}
			revision++;
			setMatch(next);
			selected = null;
			hintTurn = null;
			playSound(
				legal.promotion ? "king" : legal.captures.length ? "capture" : "move",
				preferences.sound,
			);
			render();
			if (next.outcome) resultDialog();
			else maybeComputer();
		} else if (result.purpose === "hint" || result.purpose === "analysis") {
			hintTurn = result.move;
			if (review !== null && review >= 0) {
				setMatch({
					...match,
					history: match.history.map((entry, i) =>
						i === review ? { ...entry, evaluation: result.score } : entry,
					),
				});
			}
			render();
		}
	};
	worker.onerror = () => failedWorker("The computer opponent could not start.");
}
function failedWorker(message?: string): void {
	cancelSearch();
	workerFailure = true;
	if (active() && !active()!.outcome) setMatch(pauseMatch(active()!));
	persist();
	render();
	notify(
		`${message ?? "The engine stopped unexpectedly."} Your game is paused. Try restarting the opponent.`,
	);
}
function search(purpose: SearchPurpose): void {
	const match = active();
	if (!match || match.clock.paused || document.hidden || workerFailure) return;
	if ((purpose === "hint" || purpose === "analysis") && !canAnalyze()) {
		notify("Analysis is available when it is your turn, or after the game.");
		return;
	}
	if (!worker) setupWorker();
	if (!worker || workerFailure) return;
	const budgetMs =
		purpose === "ponder"
			? 60000
			: purpose === "analysis"
				? 10000
				: purpose === "hint"
					? 2000
					: searchBudget(
							match.config.difficulty,
							match.config.timeControl === "off"
								? null
								: settleClock(match).clock.remaining[match.state.turn],
						);
	const request: SearchRequest = {
		type: "search",
		id: ++requestId,
		sessionId: match.id,
		revision,
		purpose,
		state: displayState(),
		budgetMs,
		level: purpose === "move" ? match.config.difficulty : "expert",
	};
	cancelSearch();
	pendingRequest = request;
	worker!.postMessage(request);
	if (purpose === "hint" || purpose === "analysis") {
		analysis = null;
		render();
	}
}
function maybeComputer(): void {
	const match = active();
	if (
		!match ||
		exercise ||
		view !== "play" ||
		review !== null ||
		match.outcome ||
		match.clock.paused ||
		document.hidden ||
		workerFailure
	)
		return;
	if (
		match.config.mode !== "local" &&
		match.state.turn !== match.config.humanSide
	)
		search("move");
	else if (
		match.config.mode !== "local" &&
		preferences.ponder &&
		match.config.difficulty === "expert"
	)
		search("ponder");
}
function resultDialog(): void {
	const match = active();
	if (!match?.outcome) return;
	playSound("win", preferences.sound);
	showDialog(
		match.outcome.winner ? `${capital(match.outcome.winner)} wins.` : "Draw",
		`<div class="result-emblem">${icon("crown")}</div><p>${esc(gameStatus(match).detail)}</p><p class="muted">${match.history.length} ${match.history.length === 1 ? "turn" : "turns"}</p><div class="dialog-actions">${button("close-dialog", "Review the game", "button secondary")}${button("rematch", "Play again", "button primary", "arrow")}</div>`,
	);
}
function startExercise(type: "lesson" | "puzzle", index: number): void {
	changed();
	const item = (type === "lesson" ? lessons : puzzles)[index];
	if (!item) return;
	exercise = {
		item,
		type,
		match: newMatch(
			{
				...config,
				mode: "local",
				timeControl: "off",
				mandatoryCapture: item.state.rules.mandatoryCapture,
			},
			item.state,
		),
		step: 0,
		solved: false,
		message: "",
	};
	selected = null;
	review = null;
	view = "play";
	flipped = item.state.turn === "dark";
	focusedSquare = item.solution[0]?.from ?? 20;
	render();
	window.scrollTo(0, 0);
}
function download(text: string, filename: string, type: string): void {
	const url = URL.createObjectURL(new Blob([text], { type }));
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = filename;
	anchor.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function share(state: GameState): Promise<void> {
	const link = positionLink(state);
	try {
		await navigator.clipboard.writeText(link);
		notify("Position link copied.");
	} catch {
		showDialog(
			"Share this position",
			`<label class="field-label">POSITION LINK<input value="${esc(link)}" readonly id="share-link"></label><p class="muted">Copy this link to share the position.</p>`,
		);
		document.querySelector<HTMLInputElement>("#share-link")?.select();
	}
}
function studioState(): GameState {
	return createState(
		editorBoard.map((piece, sq) =>
			piece === 1 && getCoords(sq)[0] === 7
				? 2
				: piece === 3 && getCoords(sq)[0] === 0
					? 4
					: piece,
		),
		editorTurn,
		{ mandatoryCapture: editorRules },
	);
}
function wireEditor(): void {
	const cells = root.querySelectorAll<HTMLElement>("#editor-board .walnut");
	cells.forEach((cell) => {
		const square = cell.getAttribute("aria-label")?.split(",")[0];
		const index = Number(square) - 1;
		cell.innerHTML = `<button class="square-hit" type="button" data-editor-square="${index}" aria-label="Square ${square}, ${editorBoard[index] ? `${sideOf(editorBoard[index])} ${isKing(editorBoard[index]) ? "king" : "man"}` : "empty"}">${pieceMarkup(editorBoard[index])}<span class="square-number">${square}</span></button>`;
		cell.removeAttribute("aria-label");
	});
}

root.addEventListener("click", (event) => {
	const target = (event.target as Element).closest<HTMLElement>("button, a");
	if (!target) return;
	if (target.dataset.square !== undefined) {
		squareClick(Number(target.dataset.square));
		return;
	}
	if (target.dataset.editorSquare !== undefined) {
		const square = Number(target.dataset.editorSquare);
		const side = sideOf(editorPiece);
		if (
			side &&
			sideOf(editorBoard[square]) !== side &&
			editorBoard.filter((piece) => sideOf(piece) === side).length >= 12
		) {
			notify("Each side can have at most 12 pieces.");
			return;
		}
		editorBoard[square] =
			editorPiece === 1 && square >= 28
				? 2
				: editorPiece === 3 && square < 4
					? 4
					: editorPiece;
		render();
		return;
	}
	if (target.dataset.editorPiece !== undefined) {
		editorPiece = Number(target.dataset.editorPiece);
		render();
		return;
	}
	if (target.dataset.mode) {
		changed();
		config.mode = target.dataset.mode as Mode;
		render();
		return;
	}
	if (target.dataset.lesson !== undefined) {
		startExercise("lesson", Number(target.dataset.lesson));
		return;
	}
	if (target.dataset.puzzle !== undefined) {
		startExercise("puzzle", Number(target.dataset.puzzle));
		return;
	}
	if (target.dataset.review !== undefined) {
		reviewPosition(Number(target.dataset.review));
		return;
	}
	const action = target.dataset.action;
	const match = active();
	if (!action) return;
	if (action.startsWith("load:")) {
		const saved = library.find((game) => game.id === action.slice(5));
		if (saved) {
			live = settleClock(saved);
			exercise = null;
			sandbox = null;
			selected = live.pending?.from ?? null;
			flipped = live.config.humanSide === "dark";
			changed();
			view = "play";
			review = null;
			void setActiveMatch(live.id).catch(() => undefined);
			history.replaceState(null, "", "#play");
			render();
			maybeComputer();
		}
		return;
	}
	if (action.startsWith("delete:")) {
		const id = action.slice(7);
		const removed = library.find((game) => game.id === id);
		const removedLive = live?.id === id ? live : null;
		libraryLoadVersion++;
		library = library.filter((game) => game.id !== id);
		// Stop pagehide/autosave from re-saving a game while its deletion is pending.
		if (removedLive) {
			changed();
			live = null;
		}
		const deletionRevision = revision;
		render();
		void deleteMatch(id).catch(() => {
			if (removedLive && live === null && revision === deletionRevision)
				live = removedLive;
			if (removed && !library.some((game) => game.id === id))
				library = [removed, ...library];
			if (view === "library") render();
			notify("This game could not be deleted.");
		});
		return;
	}
	switch (action) {
		case "preferences":
			preferencesDialog();
			break;
		case "close-dialog":
			document.querySelector<HTMLDialogElement>("#app-dialog")?.close();
			break;
		case "resume-game":
			if (live) {
				sandbox = null;
				view = "play";
				selected = live.pending?.from ?? null;
				review = null;
				flipped = live.config.humanSide === "dark";
				history.replaceState(null, "", "#play");
				render();
				maybeComputer();
			}
			break;
		case "new-game":
			navigate("home");
			history.replaceState(null, "", "#home");
			break;
		case "rematch":
			if (match) {
				config = { ...match.config };
				startGame(match.initial, sandbox !== null);
			}
			break;
		case "flip":
			flipped = !flipped;
			render();
			break;
		case "sound":
			preferences.sound = !preferences.sound;
			savePreferences(preferences);
			render();
			if (preferences.sound) playSound("move", true);
			break;
		case "pause":
			if (match) {
				changed();
				setMatch(match.clock.paused ? resumeMatch(match) : pauseMatch(match));
				render();
				maybeComputer();
			}
			break;
		case "play-now":
			worker?.postMessage({ type: "play-now" });
			break;
		case "retry-worker":
			setupWorker();
			if (workerFailure) break;
			if (active()?.clock.paused) setMatch(resumeMatch(active()!));
			render();
			maybeComputer();
			break;
		case "hint":
			if (exercise) {
				hintTurn = exercise.item.solution[exercise.step];
				exercise.message = "";
				render();
			} else search("hint");
			break;
		case "analyze":
			if (match?.pending) {
				notify("Complete the capture before analyzing.");
				break;
			}
			search("analysis");
			break;
		case "undo":
			if (match && canUndo(match) && !exercise) {
				changed();
				setMatch(undoMatch(match));
				selected = null;
				render();
				maybeComputer();
			}
			break;
		case "review-first":
			reviewPosition(-1);
			break;
		case "review-prev":
			if (match)
				reviewPosition(Math.max(-1, (review ?? match.history.length) - 1));
			break;
		case "review-next":
			if (match)
				reviewPosition(
					review === null || review >= match.history.length - 1
						? null
						: review + 1,
				);
			break;
		case "review-live":
			reviewPosition(null);
			break;
		case "continue-position":
			if (match) {
				const state = displayState();
				config = {
					...match.config,
					mode: "practice",
					timeControl: "off",
					humanSide: state.turn,
				};
				startGame(state, true);
			}
			break;
		case "resign":
			confirmDialog(
				"Resign?",
				"Your opponent will win this game by resignation.",
				"confirm-resign",
				"Resign",
			);
			break;
		case "confirm-resign":
			if (match) {
				changed();
				setMatch(
					finishMatch(match, {
						winner: opponent(
							match.config.mode === "local"
								? match.state.turn
								: match.config.humanSide,
						),
						reason: "resignation",
					}),
				);
				render();
				resultDialog();
			}
			break;
		case "draw":
			confirmDialog(
				"Agree to draw?",
				"Both players must agree to end the game as a draw.",
				"confirm-draw",
				"Both players agree",
			);
			break;
		case "confirm-draw":
			if (match) {
				changed();
				setMatch(finishMatch(match, { winner: null, reason: "agreement" }));
				render();
				resultDialog();
			}
			break;
		case "export-json":
			if (match)
				download(
					exportJSON(match),
					`checkers-${match.id}.json`,
					"application/json",
				);
			break;
		case "export-pdn":
			if (match) {
				if (!match.config.mandatoryCapture) {
					notify(
						"PDN export supports standard games. Use JSON from the game library for house-rule games.",
					);
					break;
				}
				download(exportPDN(match), `checkers-${match.id}.pdn`, "text/plain");
			}
			break;
		case "share-position":
			void share(displayState());
			break;
		case "exit-exercise":
			navigate("learn");
			history.replaceState(null, "", "#learn");
			break;
		case "next-exercise":
			if (exercise) {
				const items = exercise.type === "lesson" ? lessons : puzzles;
				const index = items.findIndex((item) => item.id === exercise!.item.id);
				if (index + 1 < items.length) startExercise(exercise.type, index + 1);
				else navigate("learn");
			}
			break;
		case "import":
			document.querySelector<HTMLInputElement>("#import-file")?.click();
			break;
		case "editor-clear":
			editorBoard = Array<number>(32).fill(0);
			render();
			break;
		case "editor-starting":
			editorBoard = [...createInitialState().board];
			render();
			break;
		case "editor-share":
			void share(studioState());
			break;
		case "editor-practice":
		case "editor-analyze": {
			const state = studioState();
			if (getOutcome(state)) {
				notify(
					"Add pieces for both sides and give the moving side a legal turn.",
				);
				break;
			}
			config = {
				...config,
				mode: "practice",
				timeControl: "off",
				humanSide: editorTurn,
				mandatoryCapture: editorRules,
			};
			startGame(state, true);
			if (action === "editor-analyze") search("analysis");
			break;
		}
	}
});
root.addEventListener("submit", (event) => {
	event.preventDefault();
	const form = event.target as HTMLFormElement;
	const data = new FormData(form);
	if (form.id === "setup-form") {
		config = {
			...config,
			difficulty: (data.get("difficulty") as Difficulty) ?? config.difficulty,
			humanSide: (data.get("humanSide") as Side) ?? config.humanSide,
			mandatoryCapture: data.get("mandatoryCapture") === "true",
			timeControl: data.get("timeControl") as TimeControl,
		};
		startGame();
	}
	if (form.id === "preferences-form") {
		preferences = {
			...preferences,
			appearance: data.get("appearance") as typeof preferences.appearance,
			palette: data.get("palette") as typeof preferences.palette,
			sound: data.has("sound"),
			ponder: data.has("ponder"),
			coordinates: data.has("coordinates"),
		};
		savePreferences(preferences);
		cancelSearch();
		render();
		restoreFocus(dialogOpener);
		maybeComputer();
	}
	if (form.id === "legal-form") {
		const turn = legalTurns()[Number(data.get("turn"))];
		if (turn) playTurn(turn);
	}
});
root.addEventListener("change", (event) => {
	const input = event.target as HTMLInputElement;
	if (input.closest("#setup-form")) {
		changed();
		const data = new FormData(input.closest("form")!);
		config = {
			...config,
			difficulty: (data.get("difficulty") as Difficulty) ?? config.difficulty,
			humanSide: (data.get("humanSide") as Side) ?? config.humanSide,
			mandatoryCapture: data.get("mandatoryCapture") === "true",
			timeControl: data.get("timeControl") as TimeControl,
		};
	}
	if (input.id === "editor-turn") {
		editorTurn = input.value as Side;
		render();
	}
	if (input.id === "editor-rules") {
		editorRules = input.checked;
		render();
	}
	if (input.id === "import-file" && input.files?.[0]) {
		libraryLoadVersion++;
		const file = input.files[0];
		if (file.size > 5_000_000) {
			notify("Choose a game file smaller than 5 MB.");
			return;
		}
		void file
			.text()
			.then((text) => {
				const imported = importJSON(text);
				libraryLoadVersion++;
				changed();
				live = settleClock(imported);
				const importedMatch = live;
				void setActiveMatch(importedMatch.id)
					.then(() => saveMatch(importedMatch))
					.catch(() =>
						notify(
							"Your imported game could not be stored. Export a copy to keep it.",
						),
					);
				library = [live, ...library.filter((match) => match.id !== live!.id)];
				render();
				notify("Game imported. It’s ready in your library.");
			})
			.catch(() =>
				notify("This game file is invalid or uses an unsupported version."),
			);
	}
});
root.addEventListener("keydown", (event) => {
	const button = (event.target as HTMLElement).closest<HTMLElement>(
		"[data-square]",
	);
	if (!button) return;
	const square = Number(button.dataset.square);
	if (event.key === "Escape") {
		if (!active()?.pending) {
			selected = null;
			render();
		} else announce("Finish the capture before choosing another piece.");
		return;
	}
	const deltas: Record<string, [number, number]> = {
		ArrowLeft: [0, -1],
		ArrowRight: [0, 1],
		ArrowUp: [-1, 0],
		ArrowDown: [1, 0],
	};
	const delta = deltas[event.key];
	if (!delta) return;
	event.preventDefault();
	const [row, col] = getCoords(square);
	const dir = flipped ? -1 : 1;
	let nextRow = row + delta[0] * dir;
	let nextCol = col + delta[1] * dir;
	if (delta[0] === 0) nextCol += delta[1] * dir;
	else if (getSquare(nextRow, nextCol) < 0)
		nextCol = col < 7 ? col + 1 : col - 1;
	const next = getSquare(nextRow, nextCol);
	if (next < 0) return;
	focusedSquare = next;
	root.querySelectorAll<HTMLButtonElement>("[data-square]").forEach((cell) => {
		cell.tabIndex = Number(cell.dataset.square) === next ? 0 : -1;
	});
	root.querySelector<HTMLButtonElement>(`[data-square="${next}"]`)?.focus();
});
root.addEventListener("dragstart", (event) => {
	const button = (event.target as Element).closest<HTMLElement>(
		"[data-square]",
	);
	if (!button || !canPlay()) {
		event.preventDefault();
		return;
	}
	const square = Number(button.dataset.square);
	const from = active()?.pending?.from ?? square;
	if (
		(active()?.pending && active()?.pending?.path.at(-1) !== square) ||
		!legalTurns().some((turn) => turn.from === from)
	) {
		event.preventDefault();
		return;
	}
	selected = from;
	event.dataTransfer?.setData("text/plain", String(square));
	if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
	root.querySelectorAll<HTMLElement>("[data-square]").forEach((cell) => {
		if (availableDestinations().includes(Number(cell.dataset.square)))
			cell.parentElement?.classList.add("destination");
	});
});
root.addEventListener("dragover", (event) => {
	if ((event.target as Element).closest("[data-square]")) {
		event.preventDefault();
		if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
	}
});
root.addEventListener("drop", (event) => {
	const button = (event.target as Element).closest<HTMLElement>(
		"[data-square]",
	);
	if (!button) return;
	event.preventDefault();
	squareClick(Number(button.dataset.square));
});
root.addEventListener("dragend", () => {
	if (view === "play") render();
});

// Native HTML drag is supplemented with Pointer Events for touch and pen.
let touchDrag: {
	id: number;
	from: number;
	x: number;
	y: number;
	moved: boolean;
	ghost: HTMLElement | null;
} | null = null;
let suppressTouchClickUntil = 0;
root.addEventListener(
	"click",
	(event) => {
		if (
			performance.now() < suppressTouchClickUntil &&
			(event.target as Element).closest("[data-square]")
		) {
			event.preventDefault();
			event.stopImmediatePropagation();
		}
	},
	true,
);
root.addEventListener("pointerdown", (event) => {
	if (event.pointerType === "mouse" || !canPlay()) return;
	const squareButton = (event.target as Element).closest<HTMLButtonElement>(
		'[data-square][draggable="true"]',
	);
	if (!squareButton) return;
	const square = Number(squareButton.dataset.square);
	touchDrag = {
		id: event.pointerId,
		from: active()?.pending?.from ?? square,
		x: event.clientX,
		y: event.clientY,
		moved: false,
		ghost: null,
	};
	squareButton.setPointerCapture(event.pointerId);
});
root.addEventListener("pointermove", (event) => {
	if (!touchDrag || touchDrag.id !== event.pointerId) return;
	if (
		!touchDrag.moved &&
		Math.hypot(event.clientX - touchDrag.x, event.clientY - touchDrag.y) < 9
	)
		return;
	event.preventDefault();
	if (!touchDrag.moved) {
		touchDrag.moved = true;
		selected = touchDrag.from;
		const origin = (event.target as Element).closest<HTMLElement>(
			"[data-square]",
		);
		const originalPiece = origin?.querySelector<HTMLElement>(".piece");
		if (originalPiece) {
			const ghost = originalPiece.cloneNode(true) as HTMLElement;
			const size = originalPiece.getBoundingClientRect().width;
			ghost.classList.add("drag-ghost");
			ghost.style.cssText = `position:fixed;width:${size}px;height:${size}px;z-index:100;pointer-events:none;transform:translate(-50%,-50%);opacity:.95;`;
			document.body.append(ghost);
			touchDrag.ghost = ghost;
		}
		root.querySelectorAll<HTMLElement>("[data-square]").forEach((cell) => {
			if (availableDestinations().includes(Number(cell.dataset.square)))
				cell.parentElement?.classList.add("destination");
		});
	}
	if (touchDrag.ghost) {
		touchDrag.ghost.style.left = `${event.clientX}px`;
		touchDrag.ghost.style.top = `${event.clientY}px`;
	}
});
root.addEventListener("pointerup", (event) => {
	if (!touchDrag || touchDrag.id !== event.pointerId) return;
	const drag = touchDrag;
	touchDrag = null;
	drag.ghost?.remove();
	if (!drag.moved) return;
	event.preventDefault();
	suppressTouchClickUntil = performance.now() + 500;
	const destination = document
		.elementFromPoint(event.clientX, event.clientY)
		?.closest<HTMLElement>("[data-square]");
	if (destination) squareClick(Number(destination.dataset.square));
	else render();
});
root.addEventListener("pointercancel", () => {
	touchDrag?.ghost?.remove();
	touchDrag = null;
	if (view === "play") render();
});

window.addEventListener("hashchange", () => {
	const hash = location.hash.slice(1);
	const position = linkedPosition();
	if (position) {
		editorBoard = [...position.board];
		editorTurn = position.turn;
		editorRules = position.rules.mandatoryCapture;
		navigate("editor");
	} else
		navigate(
			["play", "learn", "library", "editor"].includes(hash)
				? (hash as typeof view)
				: "home",
		);
});
document.addEventListener("visibilitychange", () => {
	if (document.hidden) {
		cancelSearch();
		if (live) {
			live = settleClock(live);
			persist();
		}
	} else {
		if (live) live = settleClock(live);
		if (view === "play") render();
		maybeComputer();
	}
});
window.addEventListener("pagehide", () => {
	if (live) {
		live = settleClock(live);
		persist();
	}
});
window.addEventListener("astra:before-update", () => {
	if (live) live = settleClock(live);
	persist();
});
window.addEventListener("astra:offline", () => {
	const label = document.querySelector("#offline-status");
	if (label) label.innerHTML = "<span></span>Offline ready";
});
window.addEventListener("astra:update-ready", () => {
	updateAvailable = true;
	if (!live || live.outcome) notify("Update available. Reload to update.");
});
setInterval(() => {
	if (
		!live ||
		live.outcome ||
		live.clock.paused ||
		live.config.timeControl === "off"
	)
		return;
	const settled = settleClock(live);
	for (const side of ["dark", "light"] as Side[]) {
		const element = document.querySelector(`#clock-${side}`);
		if (element && !exercise)
			element.textContent = timeLabel(settled.clock.remaining[side]);
	}
	if (settled.outcome) {
		const visibleLive = active() === live && view === "play";
		live = settled;
		persist();
		if (visibleLive) {
			changed();
			render();
			resultDialog();
		} else notify("Your saved timed game has ended: " + outcomeText(live));
	}
}, 150);

async function init(): Promise<void> {
	const initialRevision = revision;
	const initialHash = location.hash;
	render();
	const stored = await Promise.allSettled([getActiveMatch(), getProgress()]);
	// Progress can arrive independently, while a newly started session always wins.
	if (stored[1].status === "fulfilled")
		progress = { ...stored[1].value, ...progress };
	if (stored.some((result) => result.status === "rejected"))
		notify(
			"Some local storage is unavailable. You can still play and export games.",
		);
	if (revision !== initialRevision || location.hash !== initialHash) {
		if (view === "learn") render();
		return;
	}
	if (stored[0].status === "fulfilled") live = stored[0].value;
	if (live) live = settleClock(live);
	const position = linkedPosition();
	if (position) {
		editorBoard = [...position.board];
		editorTurn = position.turn;
		editorRules = position.rules.mandatoryCapture;
		view = "editor";
	} else {
		const hash = initialHash.slice(1);
		if (["play", "learn", "library", "editor"].includes(hash))
			view = hash as typeof view;
	}
	if (view === "play" && live) {
		selected = live.pending?.from ?? null;
		flipped = live.config.humanSide === "dark";
	}
	render();
	if (view === "library") loadLibrary();
	maybeComputer();
}
void init();
