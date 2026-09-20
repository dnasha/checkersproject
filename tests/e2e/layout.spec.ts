import { test, expect } from "@playwright/test";

test("every destination reflows without horizontal scrolling", async ({
	page,
}) => {
	for (const width of [320, 390, 640, 768, 813, 1024, 1440]) {
		await page.setViewportSize({ width, height: 900 });
		for (const route of ["home", "learn", "library", "editor"]) {
			await page.goto(`./#${route}`);
			await expect(page.locator("main")).toBeVisible();
			const overflow = await page.evaluate(() => ({
				width: document.documentElement.clientWidth,
				content: document.documentElement.scrollWidth,
				elements: [...document.querySelectorAll("body *")]
					.filter((el) => {
						const box = el.getBoundingClientRect();
						return (
							box.width > 0 &&
							(box.right > document.documentElement.clientWidth + 1 ||
								box.left < -1)
						);
					})
					.slice(0, 8)
					.map((el) => el.className),
			}));
			expect(
				overflow.content,
				`${width}px ${route}: ${JSON.stringify(overflow)}`,
			).toBeLessThanOrEqual(overflow.width + 1);
			if (route === "home" && (width === 390 || width === 1440))
				await page.screenshot({
					path: `test-results/home-${width}.png`,
					fullPage: true,
				});
		}
	}
});
