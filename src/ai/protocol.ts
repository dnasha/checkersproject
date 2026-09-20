import type { GameState, Turn } from "../core/engine";

export type Difficulty = "beginner" | "casual" | "challenging" | "expert";
export type SearchPurpose = "move" | "hint" | "analysis" | "ponder";
export interface SearchRequest {
	type: "search";
	id: number;
	sessionId: string;
	revision: number;
	purpose: SearchPurpose;
	state: GameState;
	budgetMs: number;
	level: Difficulty;
}
export type WorkerRequest =
	| SearchRequest
	| { type: "stop" }
	| { type: "play-now" };
export interface AnalysisAlternative {
	move: Turn;
	score: number;
	pv: Turn[];
}
export interface WorkerResult {
	type: "progress" | "result" | "error";
	id: number;
	sessionId: string;
	revision: number;
	purpose: SearchPurpose;
	move: Turn | null;
	/** Centipawns from Dark's perspective. 100 is roughly one man. */
	score: number;
	depth: number;
	nodes: number;
	elapsedMs: number;
	pv: Turn[];
	alternatives?: AnalysisAlternative[];
	message?: string;
}

export function searchBudget(
	level: Difficulty,
	remainingMs: number | null = null,
): number {
	const normal = {
		beginner: 100,
		casual: 300,
		challenging: 1000,
		expert: remainingMs === null ? 10000 : 2000,
	}[level];
	return remainingMs === null
		? normal
		: Math.max(5, Math.min(normal, remainingMs / 24, remainingMs - 100));
}
