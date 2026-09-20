import {
	test,
	expect,
	type Page,
	type Worker as BrowserWorker,
} from "@playwright/test";
import {
	applyTurn,
	createInitialState,
	createState,
	getLegalTurns,
	getSquare,
	sameTurn,
} from "../../src/core/engine";
import { newMatch, pauseMatch, type Match } from "../../src/core/match";
import type { SearchRequest, WorkerResult } from "../../src/ai/protocol";

// Observe real network paths here; offline/service-worker coverage lives in app.spec.
test.use({ serviceWorkers: "block" });

async function startExpert(page: Page): Promise<BrowserWorker> {
	await page.goto("./");
	await page.locator('[data-mode="practice"]').click();
	await page.locator('[name="difficulty"]').selectOption("expert");
	const created = page.waitForEvent("worker");
	await page.locator('#setup-form button[type="submit"]').click();
	await expect(page.locator("[data-square]")).toHaveCount(32);
	return created;
}

async function importMatch(page: Page, match: Match): Promise<void> {
	await page.goto("./#library");
	await page
		.locator("#import-file")
		.setInputFiles({
			name: "engine-fixture.json",
			mimeType: "application/json",
			buffer: Buffer.from(JSON.stringify(match)),
		});
	await page.locator(`[data-action="load:${match.id}"]`).click();
	await expect(page.locator("[data-square]")).toHaveCount(32);
}

test("production worker and every knowledge file resolve beneath the GitHub Pages project path", async ({
	page,
	context,
}) => {
	const responses = new Map<string, number>();
	const failures: string[] = [];
	context.on("response", (response) => {
		if (response.url().includes("/data/"))
			responses.set(new URL(response.url()).pathname, response.status());
		if (response.status() >= 400)
			failures.push(`${response.status()} ${response.url()}`);
	});
	page.on("pageerror", (error) => failures.push(error.message));
	const worker = await startExpert(page);
	expect(new URL(worker.url()).pathname).toMatch(
		/^\/checkersproject\/assets\/worker-.*\.js$/,
	);
	await expect
		.poll(() => responses.get("/checkersproject/data/opening.json"))
		.toBe(200);

	const board = Array<number>(32).fill(0);
	board[getSquare(2, 1)] = 2;
	board[getSquare(5, 6)] = 4;
	const match = newMatch(
		{
			mode: "practice",
			difficulty: "expert",
			humanSide: "dark",
			mandatoryCapture: true,
			timeControl: "off",
		},
		createState(board),
	);
	await importMatch(page, match);
	await expect
		.poll(() => responses.get("/checkersproject/data/endgame.json"))
		.toBe(200);
	await expect
		.poll(() => responses.get("/checkersproject/data/two-piece.json"))
		.toBe(200);
	expect(page.workers()).toHaveLength(1);
	expect(failures).toEqual([]);
});

test("real module-worker cancellation drops stale ponder results and returns exact analysis alternatives", async ({
	page,
}) => {
	const appWorker = await startExpert(page);
	const workerUrl = appWorker.url();
	await page.locator('.board-toolbar [data-action="pause"]').click();
	const state = createInitialState();
	const results = await page.evaluate(
		async ({ workerUrl, state }) => {
			const worker = new Worker(workerUrl, { type: "module" });
			const messages: WorkerResult[] = [];
			const base: SearchRequest = {
				type: "search",
				id: 1,
				sessionId: "browser-worker-test",
				revision: 1,
				purpose: "ponder",
				state,
				budgetMs: 10000,
				level: "expert",
			};
			try {
				return await new Promise<WorkerResult[]>((resolve, reject) => {
					const timer = setTimeout(
						() =>
							reject(
								new Error("Real worker did not finish the bounded analysis"),
							),
						5000,
					);
					let replaced = false;
					worker.onerror = (event) => {
						clearTimeout(timer);
						reject(new Error(event.message));
					};
					worker.onmessage = (event: MessageEvent<WorkerResult>) => {
						const message = event.data;
						messages.push(message);
						if (message.id === 1 && message.type === "progress" && !replaced) {
							replaced = true;
							worker.postMessage({ type: "stop" });
							worker.postMessage({
								...base,
								id: 2,
								revision: 2,
								purpose: "analysis",
								budgetMs: 200,
							});
						}
						if (message.id === 2 && message.type === "result") {
							clearTimeout(timer);
							// Let any incorrectly queued final response from the cancelled job arrive.
							setTimeout(() => resolve(messages), 50);
						}
					};
					worker.postMessage(base);
				});
			} finally {
				worker.terminate();
			}
		},
		{ workerUrl, state },
	);
	expect(results.filter((result) => result.type === "error")).toEqual([]);
	expect(
		results.filter((result) => result.type === "result" && result.id === 1),
	).toEqual([]);
	const final = results.find(
		(result) => result.type === "result" && result.id === 2,
	)!;
	expect(final).toMatchObject({
		revision: 2,
		sessionId: "browser-worker-test",
		purpose: "analysis",
	});
	expect(final.depth).toBeGreaterThan(0);
	expect(getLegalTurns(state).some((move) => sameTurn(move, final.move!))).toBe(
		true,
	);
	expect(final.alternatives).toHaveLength(3);
	expect(final.alternatives!.map((alternative) => alternative.score)).toEqual(
		final
			.alternatives!.map((alternative) => alternative.score)
			.sort((a, b) => b - a),
	);
	for (const alternative of final.alternatives!) {
		let replay = state;
		for (const move of alternative.pv) replay = applyTurn(replay, move);
	}
	await expect(
		page.getByRole("heading", { name: "Game paused" }),
	).toBeVisible();
	await expect(page.locator(".move-entry")).toHaveCount(0);
});

test("pondering stays off the interface thread and pause/navigation cancel it", async ({
	page,
}) => {
	const worker = await startExpert(page);
	await worker.evaluate(() => {
		const scope = globalThis as unknown as {
			observedRequests: { type: string; purpose?: string }[];
		};
		scope.observedRequests = [];
		globalThis.addEventListener("message", (event) =>
			scope.observedRequests.push((event as MessageEvent).data),
		);
	});
	await page.locator('.board-toolbar [data-action="pause"]').click();
	await expect(page.locator(".checkerboard")).toBeHidden();
	await expect
		.poll(() =>
			worker.evaluate(
				() =>
					(
						globalThis as unknown as { observedRequests: { type: string }[] }
					).observedRequests.at(-1)?.type,
			),
		)
		.toBe("stop");
	await page.locator('.pause-overlay [data-action="pause"]').click();
	await expect
		.poll(() =>
			worker.evaluate(
				() =>
					(
						globalThis as unknown as {
							observedRequests: { purpose?: string }[];
						}
					).observedRequests.at(-1)?.purpose,
			),
		)
		.toBe("ponder");
	const feedbackMs = await page.evaluate(() => {
		const before = performance.now();
		document.querySelector<HTMLButtonElement>('[data-action="flip"]')!.click();
		return performance.now() - before;
	});
	expect(feedbackMs).toBeLessThan(100);
	await page.getByRole("link", { name: "Learn", exact: true }).click();
	await expect
		.poll(() =>
			worker.evaluate(
				() =>
					(
						globalThis as unknown as { observedRequests: { type: string }[] }
					).observedRequests.at(-1)?.type,
			),
		)
		.toBe("stop");
	await expect(page.locator("[data-lesson]")).toHaveCount(6);
	expect(page.workers()).toHaveLength(1);
});

test("Expert respects a short foreground clock and adds the increment once", async ({
	page,
}) => {
	const match = pauseMatch(
		newMatch({
			mode: "practice",
			difficulty: "expert",
			humanSide: "light",
			mandatoryCapture: true,
			timeControl: "3+3",
		}),
	);
	match.clock.remaining.dark = 2400;
	await importMatch(page, match);
	await expect(page.locator(".pause-overlay")).toBeVisible();
	const started = Date.now();
	await page.locator('.pause-overlay [data-action="pause"]').click();
	await expect(page.locator(".move-entry")).toHaveCount(1, { timeout: 2000 });
	expect(Date.now() - started).toBeLessThan(1500);
	const darkTime = await page.locator("#clock-dark").textContent();
	expect(darkTime).toMatch(/^0:0[4-6]$/);
	await expect(page.locator('[data-action="retry-worker"]')).toHaveCount(0);
	await expect(page.locator(".player-card.current")).toContainText("You");
});
