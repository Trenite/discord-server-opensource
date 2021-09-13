import { Channel, ChannelPermissionOverwrite, ChannelUpdateEvent, emitEvent, getPermission, Member, Role } from "@fosscord/util";
import { Router, Response, Request } from "express";
import { HTTPError } from "lambert-server";

import { route } from "@fosscord/api";
const router: Router = Router();

// TODO: Only permissions your bot has in the guild or channel can be allowed/denied (unless your bot has a MANAGE_ROLES overwrite in the channel)

export interface ChannelPermissionOverwriteSchema extends ChannelPermissionOverwrite {}

router.put(
	"/:overwrite_id",
	route({ body: "ChannelPermissionOverwriteSchema", permission: "MANAGE_ROLES" }),
	async (req: Request, res: Response) => {
		const { channel_id, overwrite_id } = req.params;
		const body = req.body as { allow: bigint; deny: bigint; type: number; id: string };

		var channel = await Channel.findOneOrFail({ id: channel_id });
		if (!channel.guild_id) throw new HTTPError("Channel not found", 404);

		if (body.type === 0) {
			if (!(await Role.count({ id: overwrite_id }))) throw new HTTPError("role not found", 404);
		} else if (body.type === 1) {
			if (!(await Member.count({ id: overwrite_id }))) throw new HTTPError("user not found", 404);
		} else throw new HTTPError("type not supported", 501);

		// @ts-ignore
		var overwrite: ChannelPermissionOverwrite = channel.permission_overwrites.find((x) => x.id === overwrite_id);
		if (!overwrite) {
			// @ts-ignore
			overwrite = {
				id: overwrite_id,
				type: body.type,
				allow: body.allow,
				deny: body.deny
			};
			channel.permission_overwrites!.push(overwrite);
		}
		overwrite.allow = body.allow;
		overwrite.deny = body.deny;

		await Promise.all([
			channel.save(),
			emitEvent({
				event: "CHANNEL_UPDATE",
				channel_id,
				data: channel
			} as ChannelUpdateEvent)
		]);

		return res.sendStatus(204);
	}
);

// TODO: check permission hierarchy
router.delete("/:overwrite_id", route({ permission: "MANAGE_ROLES" }), async (req: Request, res: Response) => {
	const { channel_id, overwrite_id } = req.params;

	const channel = await Channel.findOneOrFail({ id: channel_id });
	if (!channel.guild_id) throw new HTTPError("Channel not found", 404);

	channel.permission_overwrites = channel.permission_overwrites!.filter((x) => x.id === overwrite_id);

	await Promise.all([
		channel.save(),
		emitEvent({
			event: "CHANNEL_UPDATE",
			channel_id,
			data: channel
		} as ChannelUpdateEvent)
	]);

	return res.sendStatus(204);
});

export default router;
