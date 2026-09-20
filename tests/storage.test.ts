import "fake-indexeddb/auto";
import { IDBDatabase as FakeDatabase } from "fake-indexeddb";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createInitialState, getLegalTurns } from "../src/core/engine";
import { commitTurn, newMatch } from "../src/core/match";
import {
	exportJSON,
	exportPDN,
	importJSON,
	positionLink,
	readPositionLink,
} from "../src/services/sharing";
import {
	saveMatch,
	getMatches,
	getActiveMatch,
	setActiveMatch,
	markProgress,
	getProgress,
	loadPreferences,
	savePreferences,
	deleteMatch,
} from "../src/services/storage";

const memory = new Map<string, string>();
beforeAll(() => {
	vi.stubGlobal("localStorage", {
		getItem: (key: string) => memory.get(key) ?? null,
		setItem: (key: string, value: string) => memory.set(key, value),
		removeItem: (key: string) => memory.delete(key),
	});
	vi.stubGlobal("location", { href: "https://example.test/checkersproject/" });
});
afterEach(() => {
	vi.restoreAllMocks();
});
const make = () =>
	newMatch({
		mode: "practice",
		difficulty: "casual",
		humanSide: "dark",
		mandatoryCapture: true,
		timeControl: "off",
	});
async function rawWrite(
	storeName: string,
	value: unknown,
	key: string,
): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		const open = indexedDB.open("astra-checkers", 1);
		open.onerror = () => reject(open.error);
		open.onsuccess = () => {
			const db = open.result;
			const tx = db.transaction(storeName, "readwrite");
			tx.objectStore(storeName).put(value, key);
			tx.oncomplete = () => {
				db.close();
				resolve();
			};
			tx.onabort = () => {
				db.close();
				reject(tx.error);
			};
		};
	});
}
describe("local data and portability", () => {
	it("saves games and restores the active match through validated history", async () => {
		let match = make();
		match = commitTurn(match, getLegalTurns(match.state)[0]);
		await setActiveMatch(match.id);
		await saveMatch(match);
		expect((await getActiveMatch())?.state).toEqual(match.state);
		expect((await getMatches()).some((item) => item.id === match.id)).toBe(
			true,
		);
		await deleteMatch(match.id);
		expect(await getActiveMatch()).toBeNull();
	});
	it("records progress without overwriting concurrent completions", async () => {
		await Promise.all([markProgress("lesson-one"), markProgress("lesson-two")]);
		expect(await getProgress()).toMatchObject({
			"lesson-one": true,
			"lesson-two": true,
		});
	});
	it("loads safe preferences when local data is corrupt", () => {
		memory.set("astra.preferences.v1", "{broken");
		expect(loadPreferences().appearance).toBe("light");
		const prefs = { ...loadPreferences(), appearance: "dark" as const };
		expect(savePreferences(prefs)).toBe(true);
		expect(loadPreferences()).toEqual(prefs);
	});
	it("round-trips saved games and rejects bad versions or illegal moves", () => {
		let match = make();
		match = commitTurn(match, getLegalTurns(match.state)[0]);
		expect(importJSON(exportJSON(match))).toEqual(match);
		expect(() => importJSON("{")).toThrow("valid JSON");
		expect(() =>
			importJSON(JSON.stringify({ ...match, version: 100 })),
		).toThrow("version");
	});
	it("round-trips shared positions with the project subpath preserved", () => {
		const state = createInitialState({ mandatoryCapture: false });
		const url = new URL(positionLink(state));
		expect(url.pathname).toBe("/checkersproject/");
		expect(readPositionLink(url.hash)).toEqual(state);
		expect(() => readPositionLink("#position=bad")).toThrow("invalid");
	});
	it("exports American PDN with setup metadata and correct move notation", () => {
		let match = make();
		match = commitTurn(match, getLegalTurns(match.state)[0]);
		const pdn = exportPDN(match);
		expect(pdn).toContain('[GameType "21"]');
		expect(pdn).toMatch(/1\. \d+-\d+ \*/);
		expect(() =>
			exportPDN({
				...match,
				config: { ...match.config, mandatoryCapture: false },
			}),
		).toThrow("standard");
	});
	it("a current active selection cannot be replaced by a stale IDB pointer", async () => {
		const olderSelection = make();
		olderSelection.updatedAt += 10000;
		await setActiveMatch(olderSelection.id);
		await saveMatch(olderSelection);
		const selected = make();
		await setActiveMatch(selected.id);
		await saveMatch(selected);
		// This is the persisted state after a previous IDB pointer update failed.
		await rawWrite("meta", olderSelection.id, "active");
		expect((await getActiveMatch())?.id).toBe(selected.id);
		await setActiveMatch(null);
		await rawWrite("meta", olderSelection.id, "active");
		expect(await getActiveMatch()).toBeNull();
	});
	it("takes the save snapshot before awaiting an asynchronous database operation", async () => {
		const match = make();
		const expected = structuredClone(match.initial);
		await setActiveMatch(match.id);
		const saving = saveMatch(match);
		match.initial.board.fill(0);
		await saving;
		expect(
			(await getMatches()).find((item) => item.id === match.id)?.initial,
		).toEqual(expected);
	});
	it("a late stale save cannot replace newer history or its reload checkpoint", async () => {
		const original = make();
		const moved = commitTurn(
			original,
			getLegalTurns(original.state)[0],
			original.updatedAt + 100,
		);
		await setActiveMatch(original.id);
		await saveMatch(moved);
		await saveMatch(original);
		expect((await getActiveMatch())?.history).toHaveLength(1);
		expect(
			(await getMatches()).find((item) => item.id === original.id)?.history,
		).toHaveLength(1);
	});
	it("keeps saving through IDB when the localStorage checkpoint cannot be written", async () => {
		memory.clear();
		const match = make();
		vi.spyOn(localStorage, "setItem").mockImplementation(() => {
			throw new DOMException("Storage full", "QuotaExceededError");
		});
		await setActiveMatch(match.id);
		await saveMatch(match);
		expect((await getActiveMatch())?.id).toBe(match.id);
	});
	it("recovers after a synchronous browser storage denial instead of caching rejection forever", async () => {
		vi.resetModules();
		const isolated = await import("../src/services/storage");
		vi.spyOn(indexedDB, "open").mockImplementationOnce(() => {
			throw new DOMException("Storage denied", "SecurityError");
		});
		await expect(isolated.getMatches()).rejects.toThrow("Storage denied");
		await expect(isolated.getMatches()).resolves.toBeInstanceOf(Array);
	});
	it("reports an aborted progress transaction instead of leaving its promise pending", async () => {
		const originalTransaction = FakeDatabase.prototype.transaction;
		vi.spyOn(FakeDatabase.prototype, "transaction").mockImplementation(
			function (
				this: IDBDatabase,
				stores: string | Iterable<string>,
				mode?: IDBTransactionMode,
				options?: IDBTransactionOptions,
			) {
				const tx = originalTransaction.call(this, stores, mode, options);
				if (stores === "progress" && mode === "readwrite")
					queueMicrotask(() => tx.abort());
				return tx;
			},
		);
		await expect(markProgress("aborted-lesson")).rejects.toBeDefined();
	});
	it("ignores malformed progress and position-link records", async () => {
		await rawWrite("progress", ["not", "a", "completion", "map"], "completed");
		expect(await getProgress()).toEqual({});
		await rawWrite(
			"progress",
			{ valid: true, false: false, text: "yes" },
			"completed",
		);
		expect(await getProgress()).toEqual({ valid: true });
		const missingTurn = btoa(
			JSON.stringify({ b: createInitialState().board, m: true }),
		);
		expect(() => readPositionLink(`#position=${missingTurn}`)).toThrow(
			"invalid",
		);
	});
});
