// Updates are offered explicitly. Never replace a running game's code mid-match.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
	window.addEventListener("load", async () => {
		try {
			const registration = await navigator.serviceWorker.register(
				`${import.meta.env.BASE_URL}sw.js`,
			);
			const ready = () => {
				document.documentElement.dataset.offline = "ready";
				window.dispatchEvent(
					new CustomEvent("astra:offline", { detail: "ready" }),
				);
			};
			const offerUpdate = () => {
				if (document.documentElement.dataset.matchActive === "true") return;
				if (!registration.waiting || document.getElementById("offline-update"))
					return;
				const notice = document.createElement("div");
				notice.id = "offline-update";
				notice.setAttribute("role", "status");
				notice.style.cssText =
					"position:fixed;bottom:16px;left:16px;right:16px;max-width:420px;padding:16px;background:#274c40;color:white;border-radius:12px;z-index:1000;box-shadow:0 4px 24px #0003;font:14px system-ui";
				notice.append("A new edition is ready. Your game is saved. ");
				const button = document.createElement("button");
				button.textContent = "Update when ready";
				button.style.cssText = "padding:8px;margin-top:8px;cursor:pointer";
				button.onclick = () => {
					window.dispatchEvent(new CustomEvent("astra:before-update"));
					registration.waiting?.postMessage("ACTIVATE");
					navigator.serviceWorker.addEventListener(
						"controllerchange",
						() => location.reload(),
						{ once: true },
					);
				};
				notice.append(button);
				document.body.append(notice);
			};
			if (registration.active) ready();
			offerUpdate();
			new MutationObserver(() => {
				if (document.documentElement.dataset.matchActive === "true")
					document.getElementById("offline-update")?.remove();
				else offerUpdate();
			}).observe(document.documentElement, {
				attributes: true,
				attributeFilter: ["data-match-active"],
			});
			registration.addEventListener("updatefound", () =>
				registration.installing?.addEventListener("statechange", () => {
					if (registration.waiting && navigator.serviceWorker.controller)
						offerUpdate();
				}),
			);
			navigator.serviceWorker.addEventListener("message", (event) => {
				if (event.data?.type === "OFFLINE_READY") ready();
			});
			await navigator.serviceWorker.ready;
			ready();
		} catch {
			document.documentElement.dataset.offline = "unavailable";
		}
	});
}
