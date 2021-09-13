import { Request, Response, Router } from "express";
import { Member, getPermission, Role, GuildMemberUpdateEvent, emitEvent } from "@fosscord/util";
import { HTTPError } from "lambert-server";
import { route } from "@fosscord/api";

const router = Router();

export interface MemberChangeSchema {
	roles?: string[];
}

router.get("/", route({}), async (req: Request, res: Response) => {
	const { guild_id, member_id } = req.params;
	await Member.IsInGuildOrFail(req.user_id, guild_id);

	const member = await Member.findOneOrFail({ id: member_id, guild_id });

	return res.json(member);
});

router.patch("/", route({ body: "MemberChangeSchema" }), async (req: Request, res: Response) => {
	let { guild_id, member_id } = req.params;
	if (member_id === "@me") member_id = req.user_id;
	const body = req.body as MemberChangeSchema;

	const member = await Member.findOneOrFail({ where: { id: member_id, guild_id }, relations: ["roles", "user"] });
	const permission = await getPermission(req.user_id, guild_id);

	if (body.roles) {
		permission.hasThrow("MANAGE_ROLES");
		member.roles = body.roles.map((x) => new Role({ id: x })); // foreign key constraint will fail if role doesn't exist
	}

	await member.save();
	// do not use promise.all as we have to first write to db before emitting the event to catch errors
	await emitEvent({
		event: "GUILD_MEMBER_UPDATE",
		guild_id,
		data: { ...member, roles: member.roles.map((x) => x.id) }
	} as GuildMemberUpdateEvent);

	res.json(member);
});

router.put("/", route({}), async (req: Request, res: Response) => {
	let { guild_id, member_id } = req.params;
	if (member_id === "@me") member_id = req.user_id;

	throw new HTTPError("Maintenance: Currently you can't add a member", 403);
	// TODO: only for oauth2 applications
	await Member.addToGuild(member_id, guild_id);
	res.sendStatus(204);
});

router.delete("/", route({ permission: "KICK_MEMBERS" }), async (req: Request, res: Response) => {
	const { guild_id, member_id } = req.params;

	await Member.removeFromGuild(member_id, guild_id);
	res.sendStatus(204);
});

export default router;
