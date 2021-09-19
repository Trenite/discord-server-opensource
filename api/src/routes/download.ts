import { Router, Response, Request } from "express";

const router = Router();

router.get("/", (req: Request, res: Response) => {
	res.sendStatus(204);
});

export default router;
