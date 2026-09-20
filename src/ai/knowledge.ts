import {
	getLegalTurns,
	positionKey,
	type GameState,
	type Turn,
} from "../core/engine";
import { TwoPieceTablebase, type TwoPieceFile } from "./tablebase";

export interface KnowledgeEntry {
	key: string;
	from: number;
	path: number[];
	score: number;
	depth: number;
}
export interface KnowledgeFile {
	version: 1;
	kind: "opening" | "endgame";
	description: string;
	entries: KnowledgeEntry[];
}

/** Generated finite-depth advice, never an adjudication or a tablebase claim. */
export class Knowledge {
	readonly tablebase = new TwoPieceTablebase();
	private opening = new Map<string, KnowledgeEntry>();
	private endgame = new Map<string, KnowledgeEntry>();
	private requested = new Set<string>();
	async load(
		base: string,
		kind: "opening" | "endgame" | "two-piece",
	): Promise<boolean> {
		if (this.requested.has(kind)) return false;
		this.requested.add(kind);
		try {
			const response = await fetch(`${base}data/${kind}.json`);
			if (!response.ok) return false;
			const text = await response.text();
			if (text.length > 2 * 1024 * 1024) return false;
			if (kind === "two-piece")
				this.tablebase.install(JSON.parse(text) as TwoPieceFile);
			else this.install(JSON.parse(text) as KnowledgeFile);
			return true;
		} catch {
			return false; /* Search remains fully functional without optional data. */
		}
	}
	install(file: KnowledgeFile): void {
		if (
			file.version !== 1 ||
			!Array.isArray(file.entries) ||
			!["opening", "endgame"].includes(file.kind)
		)
			return;
		const target = file.kind === "opening" ? this.opening : this.endgame;
		const limit = file.kind === "opening" ? 256 : 8192;
		for (const entry of file.entries.slice(0, limit)) {
			if (
				typeof entry.key !== "string" ||
				entry.key.length > 100 ||
				!Number.isInteger(entry.from) ||
				!Array.isArray(entry.path) ||
				entry.path.length > 12 ||
				!entry.path.every((n) => Number.isInteger(n) && n >= 0 && n < 32)
			)
				continue;
			target.set(entry.key, entry);
		}
	}
	advice(state: GameState): Turn | null {
		const exact = this.tablebase.probe(state);
		if (exact?.move) return exact.move;
		const source =
			state.board.filter(Boolean).length <= 3 ? this.endgame : this.opening;
		const entry = source.get(positionKey(state));
		if (!entry) return null;
		return (
			getLegalTurns(state).find(
				(turn) =>
					turn.from === entry.from &&
					turn.path.join(",") === entry.path.join(","),
			) ?? null
		);
	}
}
