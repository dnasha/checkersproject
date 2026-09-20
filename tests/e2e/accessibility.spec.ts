import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function accessible(page: Page) {
	const result = await new AxeBuilder({ page })
		.withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
		.analyze();
	expect(
		result.violations.map((v) => ({
			id: v.id,
			nodes: v.nodes.map((n) => ({
				target: n.target,
				failure: n.failureSummary,
			})),
		})),
	).toEqual([]);
}

test("all appearances, light palettes and dialogs retain readable contrast", async ({
	page,
}) => {
	await page.goto("./");
	for (const appearance of ["light", "dark", "contrast"]) {
		await page.locator('[data-action="preferences"]').click();
		await expect(page.getByRole("dialog")).toHaveAccessibleName(
			"Make it yours.",
		);
		await page.locator('[name="appearance"]').selectOption(appearance);
		await page.locator('[name="palette"]').selectOption("beach");
		await page.locator('[name="coordinates"]').check();
		await page.locator('#preferences-form button[type="submit"]').click();
		await expect(page.locator('[data-action="preferences"]')).toBeFocused();
		await accessible(page);
		await page.locator('[data-mode="local"]').click();
		await page.locator('#setup-form button[type="submit"]').click();
		await accessible(page);
		await page.locator('[data-action="preferences"]').click();
		await accessible(page);
		await page.keyboard.press("Escape");
		await page.locator('[data-action="new-game"]').click();
	}
});

test("learning, editor, library and result are keyboard and screen-reader discoverable", async ({
	page,
}) => {
	await page.goto("./#learn");
	await accessible(page);
	await page.locator('[data-lesson="0"]').click();
	await expect(page.locator(".square-number")).toHaveCount(32);
	await accessible(page);
	await page.getByRole("link", { name: "Studio", exact: true }).click();
	await accessible(page);
	await page.getByRole("link", { name: "Library", exact: true }).click();
	await accessible(page);
	await page.getByRole("link", { name: "Play", exact: true }).click();
	await page.locator('[data-mode="local"]').click();
	await page.locator('#setup-form button[type="submit"]').click();
	await page.locator('[data-action="resign"]').click();
	await accessible(page);
	await page.locator('[data-action="confirm-resign"]').click();
	await expect(page.getByRole("dialog")).toHaveAccessibleName(/wins/);
	await accessible(page);
});

test("touch dragging uses the same legal turn as tapping", async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto("./");
	await page.locator('[data-mode="local"]').click();
	await page.locator('#setup-form button[type="submit"]').click();
	const source = page.locator('[data-square="8"]');
	const target = page.locator('[data-square="12"]');
	const from = (await source.boundingBox())!;
	const to = (await target.boundingBox())!;
	const device = await page.context().newCDPSession(page);
	await device.send("Input.dispatchTouchEvent", {
		type: "touchStart",
		touchPoints: [{ x: from.x + from.width / 2, y: from.y + from.height / 2 }],
	});
	await device.send("Input.dispatchTouchEvent", {
		type: "touchMove",
		touchPoints: [{ x: to.x + to.width / 2, y: to.y + to.height / 2 }],
	});
	await device.send("Input.dispatchTouchEvent", {
		type: "touchEnd",
		touchPoints: [],
	});
	await expect(page.locator(".move-entry")).toHaveCount(1);
});
