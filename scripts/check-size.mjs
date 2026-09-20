import { readdir, readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
const assets = await readdir("dist/assets");
const files = await Promise.all(
	assets
		.filter((file) => /\.(js|css)$/.test(file))
		.map(async (file) => ({
			file,
			gzipBytes: gzipSync(await readFile(`dist/assets/${file}`)).byteLength,
		})),
);
const bytes = files.reduce((sum, item) => sum + item.gzipBytes, 0);
console.log(
	JSON.stringify(
		{ files, totalGzipBytes: bytes, budgetBytes: 200 * 1024 },
		null,
		2,
	),
);
if (bytes > 200 * 1024) process.exitCode = 1;
