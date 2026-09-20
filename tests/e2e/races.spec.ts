import { expect, test, type Page } from "@playwright/test";
import type { Match } from "../../src/core/match";

test.use({ serviceWorkers: "block" });

async function startLocal(page: Page): Promise<void> {
	await page.locator('[data-mode="local"]').click();
	await page.locator('#setup-form button[type="submit"]').click();
	await expect(page.locator("[data-square]")).toHaveCount(32);
}

async function exportedGame(page: Page): Promise<Match> {
	const downloading = page.waitForEvent("download");
	await page.locator('.game-actions [data-action="export-json"]').click();
	const stream = await (await downloading).createReadStream();
	if (!stream) throw new Error("Game export did not produce a readable file.");
	const chunks: Buffer[] = [];
	for await (const chunk of stream) chunks.push(Buffer.from(chunk));
	return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Match;
}

test("delayed startup restoration cannot overwrite a game started while storage opens", async ({
	page,
}) => {
	await page.goto("./");
	await startLocal(page);
	await page.locator('[data-square="8"]').click();
	await page.locator('[data-square="12"]').click();
	await expect(page.locator(".move-entry")).toHaveCount(1);
	const oldId = await page.evaluate(() =>
		localStorage.getItem("astra.active.v1"),
	);
	expect(oldId).toBeTruthy();
	await page.evaluate(() =>
		sessionStorage.setItem("astra.e2e.delay-startup", "1"),
	);

	await page.addInitScript(() => {
		if (sessionStorage.getItem("astra.e2e.delay-startup") !== "1") return;
		sessionStorage.removeItem("astra.e2e.delay-startup");
		const nativeOpen = indexedDB.open.bind(indexedDB);
		const raceWindow = window as typeof window & {
			releaseAstraStartup?: () => void;
		};
		let holding = true;
		// Hold the real database-open completion, rather than assuming a slow device.
		Object.defineProperty(indexedDB, "open", {
			configurable: true,
			value: (...args: Parameters<IDBFactory["open"]>) => {
				const request = nativeOpen(...args);
				return new Proxy(request, {
					get(target, property) {
						const value = Reflect.get(target, property, target);
						return typeof value === "function" ? value.bind(target) : value;
					},
					set(target, property, value) {
						if (
							property === "onsuccess" &&
							holding &&
							typeof value === "function"
						) {
							target.onsuccess = (event) => {
								document.documentElement.dataset.storageStartupHeld = "true";
								raceWindow.releaseAstraStartup = () => {
									holding = false;
									value.call(target, event);
									document.documentElement.dataset.storageStartupReleased =
										"true";
								};
							};
							return true;
						}
						return Reflect.set(target, property, value, target);
					},
				});
			},
		});

		const originalTransaction = IDBDatabase.prototype.transaction;
		const completed = new Set<string>();
		IDBDatabase.prototype.transaction = function (
			stores: string | Iterable<string>,
			mode?: IDBTransactionMode,
			options?: IDBTransactionOptions,
		) {
			const tx = originalTransaction.call(this, stores, mode, options);
			const name = typeof stores === "string" ? stores : null;
			if (mode === "readonly" && (name === "matches" || name === "progress")) {
				tx.addEventListener("complete", () => {
					completed.add(name);
					if (completed.has("matches") && completed.has("progress")) {
						// Run after transaction handlers and init's promise continuations.
						setTimeout(() => {
							document.documentElement.dataset.storageStartupComplete = "true";
						}, 0);
					}
				});
			}
			return tx;
		};
	});

	await page.goto("./");
	await expect(page.locator("html")).toHaveAttribute(
		"data-storage-startup-held",
		"true",
	);
	await expect(page.locator("#setup-form")).toBeVisible();
	await startLocal(page);
	const newId = await page.evaluate(() =>
		localStorage.getItem("astra.active.v1"),
	);
	expect(newId).toBeTruthy();
	expect(newId).not.toBe(oldId);
	await page.evaluate(() => {
		const release = (
			window as typeof window & { releaseAstraStartup?: () => void }
		).releaseAstraStartup;
		if (!release) throw new Error("Delayed startup was not ready to release.");
		release();
	});
	await expect(page.locator("html")).toHaveAttribute(
		"data-storage-startup-complete",
		"true",
	);
	await expect(page.locator(".move-entry")).toHaveCount(0);
	expect((await exportedGame(page)).id).toBe(newId);
	await page.reload();
	await expect(page.locator("[data-square]")).toHaveCount(32);
	await expect(page.locator(".move-entry")).toHaveCount(0);
	expect((await exportedGame(page)).id).toBe(newId);
});

test("deleting the active game and immediately hiding the page cannot resurrect it", async ({
	page,
}) => {
	await page.goto("./");
	await startLocal(page);
	await page.locator('[data-square="8"]').click();
	await page.locator('[data-square="12"]').click();
	await expect(page.locator(".move-entry")).toHaveCount(1);
	const id = await page.evaluate(() => localStorage.getItem("astra.active.v1"));
	expect(id).toBeTruthy();
	await page.getByRole("link", { name: "Library", exact: true }).click();
	await expect(page.locator(`[data-action="delete:${id}"]`)).toBeVisible();

	// The real click handler starts its asynchronous deletion. A close/hide event
	// in the same task must not autosave the match it just removed from the UI.
	await page.evaluate((gameId) => {
		const button = document.querySelector<HTMLButtonElement>(
			`[data-action="delete:${gameId}"]`,
		);
		if (!button) throw new Error("Saved game delete control was not found.");
		button.click();
		window.dispatchEvent(new PageTransitionEvent("pagehide"));
	}, id);
	await expect(page.locator(`[data-action="delete:${id}"]`)).toHaveCount(0);
	await expect
		.poll(() => page.evaluate(() => localStorage.getItem("astra.active.v1")))
		.toBe("");
	await page.reload();
	await expect(page.locator(".empty-library")).toBeVisible();
	await expect(page.locator(".saved-game")).toHaveCount(0);
	await page.getByRole("link", { name: "Play", exact: true }).click();
	await expect(page.locator("#setup-form")).toBeVisible();
	await expect(page.locator('[data-action="resume-game"]')).toHaveCount(0);
});
