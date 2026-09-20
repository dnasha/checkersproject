import { WorkerController } from "./worker-controller";
import type { WorkerRequest } from "./protocol";

const controller = new WorkerController((result) => self.postMessage(result));
const base = new URL(import.meta.env.PROD ? "../" : "../../", import.meta.url)
	.href;
self.addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
	const message = event.data;
	if (message.type === "search") {
		const kind =
			message.state.board.filter(Boolean).length <= 3 ? "endgame" : "opening";
		void controller.engine.knowledge.load(base, kind).then((changed) => {
			if (changed) controller.engine.clear();
		});
		if (kind === "endgame")
			void controller.engine.knowledge
				.load(base, "two-piece")
				.then((changed) => {
					if (changed) controller.engine.clear();
				});
	}
	controller.handle(message);
});
