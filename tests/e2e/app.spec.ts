import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createState, getSquare } from "../../src/core/engine";
import { newMatch } from "../../src/core/match";

async function start(
	page: Page,
	mode: "local" | "practice" | "challenge" = "local",
	level = "beginner",
) {
	await page.goto("./");
	await page.locator(`[data-mode="${mode}"]`).click();
	if (mode !== "local")
		await page.locator('[name="difficulty"]').selectOption(level);
	await page.locator('#setup-form button[type="submit"]').click();
	await expect(page.locator("[data-square]")).toHaveCount(32);
}
async function opening(page: Page) {
	await page.locator('[data-square="8"]').click();
	await page.locator('[data-square="12"]').click();
}
async function noOverflow(page: Page) {
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= window.innerWidth + 1,
		),
	).toBe(true);
	const rect = await page.locator(".checkerboard").first().boundingBox();
	expect(rect).not.toBeNull();
	expect(rect!.x).toBeGreaterThanOrEqual(-1);
	expect(rect!.x + rect!.width).toBeLessThanOrEqual(
		page.viewportSize()!.width + 1,
	);
}

test("choose a game, play, undo and resume through the compatible entry point", async ({
	page,
}) => {
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	await page.goto("./game.html");
	await expect(page.locator("#setup-form")).toBeVisible();
	await expect(page.locator("[data-square]")).toHaveCount(0);
	await page.locator('[data-mode="local"]').click();
	await page.locator('#setup-form button[type="submit"]').click();
	await opening(page);
	await expect(page.locator(".move-entry")).toHaveCount(1);
	await page.locator('[data-action="undo"]').click();
	await expect(page.locator(".move-entry")).toHaveCount(0);
	await opening(page);
	await page.reload();
	await expect(page.locator(".move-entry")).toHaveCount(1);
	await expect(page.locator('[data-square="12"]')).toHaveAttribute(
		"aria-label",
		/dark man/,
	);
	expect(errors).toEqual([]);
});

test("full board works at phone, tablet and desktop widths with reduced motion", async ({
	page,
}) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	for (const width of [320, 390, 768, 1440]) {
		await page.setViewportSize({ width, height: 900 });
		await start(page);
		await noOverflow(page);
		await opening(page);
		await expect(page.locator(".move-entry")).toHaveCount(1);
		if (width === 390 || width === 1440)
			await page.screenshot({
				path: `test-results/play-${width}.png`,
				fullPage: true,
			});
	}
});

test("keyboard and text move input are complete alternatives to pointing", async ({
	page,
}) => {
	await start(page);
	await expect(page.locator('[data-square][tabindex="0"]')).toHaveCount(1);
	await page.locator('[data-square="8"]').focus();
	await page.keyboard.press("Enter");
	await expect(page.locator('[data-square="8"]')).toHaveAttribute(
		"aria-pressed",
		"true",
	);
	await page.locator('[data-square="12"]').focus();
	await page.keyboard.press("Space");
	await expect(page.locator(".move-entry")).toHaveCount(1);
	await page.locator(".accessible-moves summary").click();
	await page.locator("#legal-select").selectOption({ index: 0 });
	await page.locator("#legal-form button").click();
	await expect(page.locator(".move-entry")).toHaveCount(2);
	await page.locator('[data-square="20"]').focus();
	await page.keyboard.press("ArrowLeft");
	await expect(page.locator('[data-square][tabindex="0"]')).toBeFocused();
});

test("Expert stays responsive, Play now works, and reset cancels stale work", async ({
	page,
}) => {
	await start(page, "practice", "expert");
	await opening(page);
	await expect(page.locator('[data-action="play-now"]')).toBeVisible();
	await expect(page.locator('[data-action="analyze"]')).toBeDisabled();
	const before = Date.now();
	await page.locator('[data-action="flip"]').click();
	expect(Date.now() - before).toBeLessThan(1000);
	await page.locator('[data-action="play-now"]').click();
	await expect(page.locator(".move-entry")).toHaveCount(2);
	await page.locator('[data-action="new-game"]').click();
	await page.locator('[data-mode="local"]').click();
	await page.locator('#setup-form button[type="submit"]').click();
	await expect(page.locator(".move-entry")).toHaveCount(0);
	await expect(page.locator('[data-square="8"]')).toHaveAttribute(
		"aria-label",
		/dark man/,
	);
});

test("challenge gates assistance and pause conceals the board", async ({
	page,
}) => {
	await start(page, "challenge");
	await expect(page.locator('[data-action="hint"]')).toHaveCount(0);
	await expect(page.locator('[data-action="undo"]')).toHaveCount(0);
	await page.locator('.board-toolbar [data-action="pause"]').click();
	await expect(
		page.getByRole("heading", { name: "Game paused" }),
	).toBeVisible();
	await expect(page.locator(".checkerboard")).toBeHidden();
	await page.locator('.pause-overlay [data-action="pause"]').click();
	await expect(page.locator(".checkerboard")).toBeVisible();
});

test("an unfinished capture survives import and reload with the same piece locked", async ({
	page,
}) => {
	const board = Array(32).fill(0);
	board[getSquare(1, 0)] = 1;
	board[getSquare(2, 1)] = 3;
	board[getSquare(4, 3)] = 3;
	board[getSquare(7, 6)] = 4;
	const game = newMatch(
		{
			mode: "local",
			difficulty: "casual",
			humanSide: "dark",
			mandatoryCapture: true,
			timeControl: "off",
		},
		createState(board),
	);
	await page.goto("./#library");
	await page.locator("#import-file").setInputFiles({
		name: "capture.json",
		mimeType: "application/json",
		buffer: Buffer.from(JSON.stringify(game)),
	});
	await page.locator(`[data-action="load:${game.id}"]`).click();
	await page.locator('[data-square="4"]').click();
	await page.locator('[data-square="13"]').click();
	await expect(
		page.getByText("Continue capture", { exact: true }),
	).toBeVisible();
	await page.reload();
	await expect(page.locator('[data-square="13"]')).toHaveAttribute(
		"aria-label",
		/dark man/,
	);
	await expect(page.locator(".move-entry")).toHaveCount(0);
	await page.locator('[data-square="22"]').click();
	await expect(page.locator(".move-entry")).toHaveCount(1);
});

test("lessons, puzzles, editor and saved live game remain independent", async ({
	page,
}) => {
	await start(page);
	await opening(page);
	await page.getByRole("link", { name: "Learn", exact: true }).click();
	await expect(page.locator("[data-lesson]")).toHaveCount(6);
	await expect(page.locator("[data-puzzle]")).toHaveCount(24);
	await page.locator('[data-lesson="0"]').click();
	await page.locator('[data-square="9"]').click();
	await page.locator('[data-square="14"]').click();
	await expect(page.getByText("Solved", { exact: true })).toBeVisible();
	await page.getByRole("link", { name: "Play", exact: true }).click();
	await page.locator('[data-action="resume-game"]').click();
	await expect(page.locator(".move-entry")).toHaveCount(1);
	await page.getByRole("link", { name: "Editor", exact: true }).click();
	await page.locator('[data-action="editor-starting"]').click();
	await expect(page.locator("#editor-board .piece")).toHaveCount(24);
});

test("subpath build is accessible and fully usable after going offline", async ({
	page,
	context,
}) => {
	const failed: string[] = [];
	page.on("response", (response) => {
		if (
			response.status() >= 400 &&
			response.url().includes("/checkersproject/")
		)
			failed.push(response.url());
	});
	await page.goto("./");
	await expect(page.locator("html")).toHaveAttribute("data-offline", "ready", {
		timeout: 20000,
	});
	const homeScan = await new AxeBuilder({ page })
		.withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
		.analyze();
	expect(homeScan.violations).toEqual([]);
	await start(page);
	const gameScan = await new AxeBuilder({ page })
		.withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
		.analyze();
	expect(gameScan.violations).toEqual([]);
	await context.setOffline(true);
	await page.reload();
	await expect(page.locator("[data-square]")).toHaveCount(32);
	await opening(page);
	await expect(page.locator(".move-entry")).toHaveCount(1);
	await page.locator('[data-action="new-game"]').click();
	await page.locator('[data-mode="practice"]').click();
	await page.locator('[name="difficulty"]').selectOption("beginner");
	await page.locator('#setup-form button[type="submit"]').click();
	await opening(page);
	await expect(page.locator(".move-entry")).toHaveCount(2);
	expect(failed).toEqual([]);
});
