import { test, expect, type Page } from "@playwright/test";
import type { Match } from "../../src/core/match";

test.use({ serviceWorkers: "block" });
test.beforeEach(async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
});

async function startLocal(
	page: Page,
	timed = false,
	navigate = true,
): Promise<void> {
	if (navigate) await page.goto("./");
	await page.locator('[data-mode="local"]').click();
	await page
		.locator('[name="timeControl"]')
		.selectOption(timed ? "3+3" : "off");
	await page.locator('#setup-form button[type="submit"]').click();
	await expect(page.locator("[data-square]")).toHaveCount(32);
}

async function exportGame(page: Page): Promise<Match> {
	const pending = page.waitForEvent("download");
	await page.locator('.game-actions [data-action="export-json"]').click();
	const download = await pending;
	const stream = await download.createReadStream();
	if (!stream)
		throw new Error("The game export did not produce a readable file.");
	const chunks: Buffer[] = [];
	for await (const chunk of stream) chunks.push(Buffer.from(chunk));
	return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Match;
}

test("elapsed clocks survive pause and reload, apply one increment, and time out exactly once", async ({
	page,
}) => {
	await page.clock.install({ time: new Date("2026-09-20T12:00:00Z") });
	await page.goto("./");
	await expect(page.locator("#setup-form")).toBeVisible();
	await page.clock.pauseAt(new Date("2026-09-20T12:01:00Z"));
	await startLocal(page, true, false);
	await expect(page.locator("#clock-dark")).toHaveText("3:00");
	await expect(page.locator("#clock-light")).toHaveText("3:00");

	await page.clock.runFor(2000);
	await page.locator('[data-square="8"]').click();
	await page.locator('[data-square="12"]').click();
	await expect(page.locator(".move-entry")).toHaveCount(1);
	// 180 seconds - 2 spent + 3 increment, once for the completed turn.
	await expect(page.locator("#clock-dark")).toHaveText("3:01");
	await page.clock.runFor(4000);
	await page.locator('.board-toolbar [data-action="pause"]').click();
	await expect(page.locator("#clock-light")).toHaveText("2:56");
	await page.clock.fastForward(60000);
	await expect(page.locator("#clock-dark")).toHaveText("3:01");
	await expect(page.locator("#clock-light")).toHaveText("2:56");

	const paused = await exportGame(page);
	expect(paused.clock.paused).toBe(true);
	expect(paused.clock.remaining).toEqual({ dark: 181000, light: 176000 });
	await page.reload();
	await expect(page.locator(".pause-overlay")).toBeVisible();
	await expect(page.locator("#clock-dark")).toHaveText("3:01");
	await expect(page.locator("#clock-light")).toHaveText("2:56");
	await expect(page.locator(".move-entry")).toHaveCount(1);

	await page.locator('.pause-overlay [data-action="pause"]').click();
	// A throttled/background-style jump must charge elapsed time, not one tick.
	await page.clock.fastForward(176001);
	await expect(
		page.getByRole("dialog").getByRole("heading", { name: "Dark wins." }),
	).toBeVisible();
	await expect(page.locator("#clock-light")).toHaveText("0:00");
	await page
		.getByRole("button", { name: "Review the game", exact: true })
		.click();
	const ended = await exportGame(page);
	expect(ended.outcome).toEqual({ winner: "dark", reason: "timeout" });
	expect(ended.clock.remaining.dark).toBe(181000);
	expect(ended.history).toHaveLength(1);
	await page.clock.fastForward(60000);
	const stillEnded = await exportGame(page);
	expect(stillEnded.outcome).toEqual(ended.outcome);
	expect(stillEnded.clock.remaining).toEqual(ended.clock.remaining);
	expect(stillEnded.history).toHaveLength(1);
});

test("a failed worker pauses the game and Retry starts a healthy opponent", async ({
	page,
}) => {
	let failuresToInject = 1;
	await page.route(/\/assets\/worker-[^/]+\.js$/, async (route) => {
		if (failuresToInject-- > 0)
			await route.fulfill({
				status: 200,
				contentType: "text/javascript",
				body: "throw new Error('Injected browser worker failure');",
			});
		else await route.continue();
	});
	await page.goto("./");
	await page.locator('[data-mode="practice"]').click();
	await page.locator('[name="difficulty"]').selectOption("beginner");
	await page.locator('[name="humanSide"]').selectOption("light");
	await page.locator('#setup-form button[type="submit"]').click();
	await expect(page.locator(".pause-overlay")).toBeVisible();
	await expect(page.locator('[data-action="retry-worker"]')).toBeVisible();
	await expect(page.locator(".move-entry")).toHaveCount(0);
	await page.locator('[data-action="retry-worker"]').click();
	await expect(page.locator(".pause-overlay")).toHaveCount(0);
	await expect(page.locator(".move-entry")).toHaveCount(1);
	await expect(page.locator('[data-action="retry-worker"]')).toHaveCount(0);
	await expect(page.locator(".player-card.current")).toContainText("You");
	await expect.poll(() => page.workers().length).toBe(1);
});

test("continuing from replay leaves the original saved game and its moves intact", async ({
	page,
}) => {
	await startLocal(page, true);
	await page.locator('[data-square="8"]').click();
	await page.locator('[data-square="12"]').click();
	await page.locator('[data-square="20"]').click();
	await page.locator('[data-square="16"]').click();
	await expect(page.locator(".move-entry")).toHaveCount(2);
	const original = await exportGame(page);
	await page.locator('[data-action="review-first"]').click();
	await expect(page.locator('[data-square="8"]')).toHaveAttribute(
		"aria-label",
		/dark man/,
	);
	await page.locator('[data-action="continue-position"]').click();
	await expect(page.locator(".move-entry")).toHaveCount(0);
	await expect(page.locator(".clock")).toHaveCount(0);
	const continuation = await exportGame(page);
	expect(continuation.id).not.toBe(original.id);
	expect(continuation.config).toMatchObject({
		mode: "practice",
		timeControl: "off",
	});
	expect(continuation.initial.board).toEqual(original.initial.board);
	await page.getByRole("link", { name: "Library", exact: true }).click();
	await expect(
		page.locator(`[data-action="load:${continuation.id}"]`),
	).toBeVisible();
	await page.locator(`[data-action="load:${original.id}"]`).click();
	await expect(page.locator(".move-entry")).toHaveCount(2);
	await expect(page.locator('[data-square="12"]')).toHaveAttribute(
		"aria-label",
		/dark man/,
	);
	await expect(page.locator('[data-square="16"]')).toHaveAttribute(
		"aria-label",
		/light man/,
	);
	const restored = await exportGame(page);
	expect(restored.id).toBe(original.id);
	expect(restored.history).toEqual(original.history);
	expect(restored.state).toEqual(original.state);
});

test("malformed position links report an error and leave a playable landing page", async ({
	page,
}) => {
	const uncaught: string[] = [];
	page.on("pageerror", (error) => uncaught.push(error.message));
	const invalidBoard = Buffer.from(
		JSON.stringify({ b: [1, 3], t: "dark", m: true }),
	).toString("base64");
	for (const encoded of ["%E0%A4%A", invalidBoard, "a".repeat(4100)]) {
		await page.goto(`./#position=${encoded}`);
		await expect(page.locator("#setup-form")).toBeVisible();
		await expect(page.locator("#toast")).toContainText(
			"This position link is invalid",
		);
	}
	await startLocal(page, false, false);
	await page.locator('[data-square="8"]').click();
	await page.locator('[data-square="12"]').click();
	await expect(page.locator(".move-entry")).toHaveCount(1);
	expect(uncaught).toEqual([]);
});
