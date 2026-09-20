import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
	testDir: "./tests/e2e",
	timeout: 30000,
	expect: { timeout: 7000 },
	fullyParallel: false,
	workers: 1,
	retries: process.env.CI ? 1 : 0,
	reporter: [["list"], ["html", { open: "never" }]],
	use: {
		baseURL: "http://127.0.0.1:4173/checkersproject/",
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
	},
	projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
	webServer: {
		command: "node scripts/serve-preview.mjs",
		url: "http://127.0.0.1:4173/checkersproject/",
		reuseExistingServer: !process.env.CI,
	},
});
