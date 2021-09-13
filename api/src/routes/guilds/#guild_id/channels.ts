import { Router, Response, Request } from "express";
import { Channel, ChannelUpdateEvent, getPermission, emitEvent } from "@fosscord/util";
import { HTTPError } from "lambert-server";
import { route } from "@fosscord/api";
import { ChannelModifySchema } from "../../channels/#channel_id";
const router = Router();

router.get("/", async (req: Request, res: Response) => {
	const { guild_id } = req.params;
	const channels = await Channel.find({ guild_id });

	res.json(channels);
});

router.post("/", route({ body: "ChannelModifySchema", permission: "MANAGE_CHANNELS" }), async (req: Request, res: Response) => {
	// creates a new guild channel https://discord.com/developers/docs/resources/guild#create-guild-channel
	const { guild_id } = req.params;
	const body = req.body as ChannelModifySchema;

	const channel = await Channel.createChannel({ ...body, guild_id }, req.user_id);

	res.status(201).json(channel);
});

export type ChannelReorderSchema = { id: string; position?: number; lock_permissions?: boolean; parent_id?: string }[];

router.patch("/", route({ body: "ChannelReorderSchema", permission: "MANAGE_CHANNELS" }), async (req: Request, res: Response) => {
	// changes guild channel position
	const { guild_id } = req.params;
	const body = req.body as ChannelReorderSchema;

	await Promise.all([
		body.map(async (x) => {
			if (!x.position && !x.parent_id) throw new HTTPError(`You need to at least specify position or parent_id`, 400);

			const opts: any = {};
			if (x.position) opts.position = x.position;

			if (x.parent_id) {
				opts.parent_id = x.parent_id;
				const parent_channel = await Channel.findOneOrFail({
					where: { id: x.parent_id, guild_id },
					select: ["permission_overwrites"]
				});
				if (x.lock_permissions) {
					opts.permission_overwrites = parent_channel.permission_overwrites;
				}
			}

			await Channel.update({ guild_id, id: x.id }, opts);
			const channel = await Channel.findOneOrFail({ guild_id, id: x.id });

			await emitEvent({ event: "CHANNEL_UPDATE", data: channel, channel_id: x.id, guild_id } as ChannelUpdateEvent);
		})
	]);

	res.sendStatus(204);
});

export default router;
