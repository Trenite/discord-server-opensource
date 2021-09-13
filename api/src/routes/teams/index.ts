import { Router, Request, Response } from "express";

const router: Router = Router();

router.post("/", async (req: Request, res: Response) => {
        //TODO
		res.json([]);
		res.status(200)
	}
);
export default router;