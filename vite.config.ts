import { defineConfig } from "vitest/config";
import type { Plugin } from "vite";
import { resolve } from "node:path";

function offline(): Plugin {
	return {
		name: "astra-offline",
		enforce: "post",
		generateBundle: {
			order: "post",
			handler(_options, bundle) {
				const files = [
					...Object.keys(bundle),
					"index.html",
					"game.html",
					"manifest.webmanifest",
					"icon.svg",
					"icon-192.png",
					"icon-512.png",
					"data/opening.json",
					"data/endgame.json",
					"data/two-piece.json",
				];
				const version = `astra-${Date.now()}`;
				this.emitFile({
					type: "asset",
					fileName: "sw.js",
					source: `
const CACHE=${JSON.stringify(version)};
const FILES=${JSON.stringify([...new Set(files)])};
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 for(const path of FILES){const url=new URL(path,self.registration.scope);const response=await fetch(url,{cache:'reload'});if(!response.ok)throw new Error('Offline preparation failed: '+path);await cache.put(url,response);}
})()));
self.addEventListener('message',event=>{if(event.data==='ACTIVATE')self.skipWaiting();});
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 for(const key of await caches.keys())if(key.startsWith('astra-')&&key!==CACHE)await caches.delete(key);
 await self.clients.claim();
 for(const client of await self.clients.matchAll())client.postMessage({type:'OFFLINE_READY'});
})()));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
 event.respondWith((async()=>{const cache=await caches.open(CACHE);const hit=await cache.match(event.request,{ignoreSearch:true});if(hit)return hit;
 try{return await fetch(event.request);}catch(error){if(event.request.mode==='navigate'){const page=await cache.match(new URL('index.html',self.registration.scope));if(page)return page;}throw error;}})());
});`,
				});
			},
		},
	};
}

export default defineConfig({
	base: "./",
	plugins: [offline()],
	worker: { format: "es" },
	build: {
		target: "es2022",
		rollupOptions: {
			input: { index: resolve("index.html"), game: resolve("game.html") },
		},
	},
	test: { include: ["tests/**/*.test.ts"], exclude: ["tests/e2e/**"] },
});
