import { getLegalTurns, getOutcome, type Turn } from "../core/engine";
import { SearchEngine, type SearchControl, type SearchInfo } from "./search";
import type { SearchRequest, WorkerRequest, WorkerResult } from "./protocol";

const priority = { ponder: 0, analysis: 1, hint: 1, move: 2 };
function sameMove(a: Turn, b: Turn): boolean {
	return a.from === b.from && a.path.join(",") === b.path.join(",");
}

/** Separated from the worker global so lifecycle/cancellation are directly testable. */
export class WorkerController {
	readonly engine = new SearchEngine();
	private active: { request: SearchRequest; control: SearchControl } | null =
		null;
	constructor(private emit: (result: WorkerResult) => void) {}

	handle(message: WorkerRequest): void {
		if (message.type === "stop") {
			if (this.active) this.active.control.cancelled = true;
			this.active = null;
			return;
		}
		if (message.type === "play-now") {
			if (this.active) this.active.control.finish = true;
			return;
		}
		if (
			this.active &&
			priority[message.purpose] < priority[this.active.request.purpose]
		) {
			this.error(message, "A higher-priority search is running.");
			return;
		}
		if (this.active) this.active.control.cancelled = true;
		const job = {
			request: message,
			control: { cancelled: false, finish: false },
		};
		this.active = job;
		const publish = (type: "progress" | "result", info: SearchInfo) => {
			if (this.active !== job || job.control.cancelled) return;
			const legal = getLegalTurns(message.state);
			if (info.move && !legal.some((turn) => sameMove(turn, info.move!)))
				throw new Error("Search returned an illegal move.");
			this.emit({
				type,
				id: message.id,
				sessionId: message.sessionId,
				revision: message.revision,
				purpose: message.purpose,
				...info,
			});
		};
		void this.engine
			.search(message.state, {
				budgetMs: message.budgetMs,
				level: message.purpose === "move" ? message.level : "expert",
				multiPV: message.purpose === "analysis",
				control: job.control,
				onProgress: (info) => publish("progress", info),
			})
			.then((result) => {
				if (result) publish("result", result);
				if (this.active === job) this.active = null;
			})
			.catch((error) => {
				if (this.active !== job) return;
				this.active = null;
				this.error(
					message,
					error instanceof Error ? error.message : "Search failed.",
				);
			});
	}

	private error(request: SearchRequest, message: string): void {
		this.emit({
			type: "error",
			id: request.id,
			sessionId: request.sessionId,
			revision: request.revision,
			purpose: request.purpose,
			move: getOutcome(request.state)
				? null
				: (getLegalTurns(request.state)[0] ?? null),
			score: 0,
			depth: 0,
			nodes: 0,
			elapsedMs: 0,
			pv: [],
			message,
		});
	}
}
