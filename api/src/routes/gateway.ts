import { Config } from "@fosscord/util";
import { Router, Response, Request } from "express";
import { route } from "@fosscord/api";

const router = Router();

router.get("/", route({}), (req: Request, res: Response) => {
	const { endpoint } = Config.get().gateway;
	res.json({ url: endpoint || process.env.GATEWAY || "ws://localhost:3002" });
});

router.get("/bot", route({}), (req: Request, res: Response) => {
	const { endpoint } = Config.get().gateway;
	res.json({
		url: endpoint || process.env.GATEWAY || "ws://localhost:3002",
		shards: 1,
		session_start_limit: {
			total: 1000,
			remaining: 999,
			reset_after: 14400000,
			max_concurrency: 1
		}
	});
});

export default router;
