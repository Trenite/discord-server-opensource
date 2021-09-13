import { Request, Response, Router } from "express";
import { Guild, Member, PublicMemberProjection } from "@fosscord/util";
import { route } from "@fosscord/api";
import { MoreThan } from "typeorm";
import { HTTPError } from "lambert-server";

const router = Router();

// TODO: not allowed for user -> only allowed for bots with privileged intents
// TODO: send over websocket
// TODO: check for GUILD_MEMBERS intent

router.get("/", route({}), async (req: Request, res: Response) => {
	const { guild_id } = req.params;
	const limit = Number(req.query.limit) || 1;
	if (limit > 1000 || limit < 1) throw new HTTPError("Limit must be between 1 and 1000");
	const after = `${req.query.after}`;
	const query = after ? { id: MoreThan(after) } : {};

	await Member.IsInGuildOrFail(req.user_id, guild_id);

	const members = await Member.find({
		where: { guild_id, ...query },
		select: PublicMemberProjection,
		take: limit,
		order: { id: "ASC" }
	});

	return res.json(members);
});

export default router;
