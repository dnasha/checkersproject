import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";

const root = resolve("dist");
const base = "/checkersproject/";
const types = {
	".html": "text/html",
	".js": "text/javascript",
	".css": "text/css",
	".json": "application/json",
	".webmanifest": "application/manifest+json",
	".svg": "image/svg+xml",
	".png": "image/png",
	".woff2": "font/woff2",
};
http
	.createServer(async (request, response) => {
		try {
			const path = decodeURIComponent(
				new URL(request.url, "http://localhost").pathname,
			);
			if (path === "/checkersproject") {
				response.writeHead(301, { Location: base });
				response.end();
				return;
			}
			if (!path.startsWith(base)) {
				response.writeHead(404);
				response.end("Not found");
				return;
			}
			let file = resolve(root, path.slice(base.length) || "index.html");
			if (file !== root && !file.startsWith(root + sep)) {
				response.writeHead(403);
				response.end();
				return;
			}
			if ((await stat(file)).isDirectory()) file = resolve(file, "index.html");
			response.writeHead(200, {
				"Content-Type": types[extname(file)] || "application/octet-stream",
				"Cache-Control": "no-store",
			});
			response.end(await readFile(file));
		} catch {
			response.writeHead(404);
			response.end("Not found");
		}
	})
	.listen(4173, "127.0.0.1", () =>
		console.log("Astra preview: http://127.0.0.1:4173/checkersproject/"),
	);
