import { settleClock, validateMatch, type Match } from "../core/match";

export interface Preferences {
	appearance: "light" | "dark" | "contrast";
	palette: "wood" | "classic" | "ice" | "beach" | "forest" | "pink" | "ukraine";
	sound: boolean;
	ponder: boolean;
	coordinates: boolean;
}
const defaults: Preferences = {
	appearance: "light",
	palette: "wood",
	sound: true,
	ponder: true,
	coordinates: false,
};
const preferencesKey = "astra.preferences.v1";
const activeKey = "astra.active.v1";
const backupKey = "astra.backup.v1";
let dbPromise: Promise<IDBDatabase> | undefined;

export function loadPreferences(): Preferences {
	try {
		const data = JSON.parse(localStorage.getItem(preferencesKey) || "{}");
		return {
			appearance: ["light", "dark", "contrast"].includes(data.appearance)
				? data.appearance
				: defaults.appearance,
			palette: [
				"wood",
				"classic",
				"ice",
				"beach",
				"forest",
				"pink",
				"ukraine",
			].includes(data.palette)
				? data.palette
				: defaults.palette,
			sound: typeof data.sound === "boolean" ? data.sound : defaults.sound,
			ponder: typeof data.ponder === "boolean" ? data.ponder : defaults.ponder,
			coordinates:
				typeof data.coordinates === "boolean"
					? data.coordinates
					: defaults.coordinates,
		};
	} catch {
		return { ...defaults };
	}
}
export function savePreferences(prefs: Preferences): boolean {
	try {
		localStorage.setItem(preferencesKey, JSON.stringify(prefs));
		return true;
	} catch {
		return false;
	}
}
function database(): Promise<IDBDatabase> {
	if (!dbPromise)
		dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
			let rejected = false;
			const fail = (message: string) => {
				rejected = true;
				reject(new Error(message));
			};
			const request = indexedDB.open("astra-checkers", 1);
			request.onupgradeneeded = () => {
				const db = request.result;
				db.createObjectStore("matches", { keyPath: "id" });
				db.createObjectStore("meta");
				db.createObjectStore("progress");
			};
			request.onsuccess = () => {
				const db = request.result;
				// A blocked open can later succeed even though its caller already failed.
				if (rejected) {
					db.close();
					return;
				}
				db.onversionchange = () => {
					db.close();
					dbPromise = undefined;
				};
				db.onclose = () => {
					dbPromise = undefined;
				};
				resolve(db);
			};
			request.onerror = () =>
				fail(
					"Browser storage is unavailable. Export your game to keep a copy.",
				);
			request.onblocked = () =>
				fail("Close another Checkers tab to update local storage.");
		}).catch((error) => {
			// This also covers a synchronous SecurityError from indexedDB.open().
			dbPromise = undefined;
			throw error;
		});
	return dbPromise;
}
async function read<T>(
	store: string,
	action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
	const db = await database();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(store, "readonly");
		const request = action(tx.objectStore(store));
		tx.oncomplete = () => resolve(request.result);
		request.onerror = () =>
			reject(request.error || new Error("Could not read saved games."));
		tx.onabort = () =>
			reject(tx.error || new Error("Reading saved games was interrupted."));
	});
}
async function write(
	store: string,
	action: (store: IDBObjectStore) => void,
): Promise<void> {
	const db = await database();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(store, "readwrite");
		action(tx.objectStore(store));
		tx.oncomplete = () => resolve();
		tx.onerror = () =>
			reject(
				tx.error ||
					new Error("Could not save. Export your game to keep a copy."),
			);
		tx.onabort = () => reject(tx.error || new Error("Saving was interrupted."));
	});
}
export async function saveMatch(match: Match): Promise<void> {
	// Capture the invocation's state before opening the database yields control.
	const snapshot = structuredClone(match);
	// The small synchronous checkpoint also covers pagehide and abrupt tab closure.
	try {
		const active = localStorage.getItem(activeKey);
		if (active === null || active === snapshot.id) {
			let previous: Match | undefined;
			try {
				previous = JSON.parse(localStorage.getItem(backupKey) || "null") as
					| Match
					| undefined;
			} catch {
				/* Replace a corrupt checkpoint. */
			}
			if (
				!previous ||
				previous.id !== snapshot.id ||
				!(previous.updatedAt > snapshot.updatedAt)
			)
				localStorage.setItem(backupKey, JSON.stringify(snapshot));
		}
	} catch {
		/* IndexedDB can still succeed. */
	}
	await write("matches", (store) => {
		const request = store.get(snapshot.id);
		request.onsuccess = () => {
			// A late async callback must not overwrite a newer autosave or undo.
			const previous = request.result as Match | undefined;
			if (!previous || !(previous.updatedAt > snapshot.updatedAt))
				store.put(snapshot);
		};
	});
}
export async function getMatches(): Promise<Match[]> {
	const records = await read<unknown[]>("matches", (store) => store.getAll());
	const games: Match[] = [];
	for (const record of records) {
		try {
			games.push(validateMatch(record));
		} catch {
			/* A corrupt/old record cannot break the library. */
		}
	}
	return games.sort((a, b) => b.updatedAt - a.updatedAt);
}
export async function setActiveMatch(id: string | null): Promise<void> {
	// An empty marker records an intentional clear, even if IDB cannot persist it.
	try {
		localStorage.setItem(activeKey, id || "");
		if (!id) localStorage.removeItem(backupKey);
	} catch {
		/* Use IDB below. */
	}
	await write("meta", (store) => {
		store.put(id, "active");
	});
}
export async function getActiveMatch(): Promise<Match | null> {
	let backup: Match | null = null;
	let selected: string | null = null;
	try {
		const data = localStorage.getItem(backupKey);
		selected = localStorage.getItem(activeKey);
		if (selected === "") return null;
		if (data) {
			const parsed = validateMatch(JSON.parse(data));
			if (selected === null || parsed.id === selected) backup = parsed;
		}
	} catch {
		/* Ignore invalid checkpoint. */
	}
	try {
		// A successful synchronous selection is newer than an old IDB pointer.
		const id =
			selected ??
			(await read<string | null>("meta", (store) => store.get("active")));
		if (selected === null && id && backup?.id !== id) backup = null;
		if (id) {
			const raw = await read<unknown>("matches", (store) => store.get(id));
			if (raw) {
				const saved = validateMatch(raw);
				if (!backup || saved.updatedAt > backup.updatedAt) backup = saved;
			}
		}
	} catch (error) {
		if (!backup) throw error;
	}
	return backup ? settleClock(backup) : null;
}
export async function deleteMatch(id: string): Promise<void> {
	await write("matches", (store) => {
		store.delete(id);
	});
	let active: string | null = null;
	try {
		active = localStorage.getItem(activeKey);
	} catch {
		/* Use IDB below. */
	}
	active ??= await read<string | null>("meta", (store) => store.get("active"));
	if (active === id) await setActiveMatch(null);
}
export async function getProgress(): Promise<Record<string, boolean>> {
	const raw = await read<unknown>("progress", (store) =>
		store.get("completed"),
	);
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
	return Object.fromEntries(
		Object.entries(raw).filter(
			([id, done]) => /^[a-z0-9-]{1,80}$/.test(id) && done === true,
		),
	);
}
export async function markProgress(id: string): Promise<void> {
	if (!/^[a-z0-9-]{1,80}$/.test(id))
		throw new Error("Invalid lesson identifier.");
	const db = await database();
	await new Promise<void>((resolve, reject) => {
		const tx = db.transaction("progress", "readwrite");
		const store = tx.objectStore("progress");
		const request = store.get("completed");
		request.onsuccess = () => {
			store.put({ ...request.result, [id]: true }, "completed");
		};
		tx.oncomplete = () => resolve();
		tx.onerror = () =>
			reject(tx.error || new Error("Could not save learning progress."));
		tx.onabort = () =>
			reject(
				tx.error || new Error("Saving learning progress was interrupted."),
			);
	});
}
