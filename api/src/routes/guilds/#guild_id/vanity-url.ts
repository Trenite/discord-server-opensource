import { Channel, ChannelType, getPermission, Guild, Invite, trimSpecial } from "@fosscord/util";
import { Router, Request, Response } from "express";
import { route } from "@fosscord/api";

const router = Router();

const InviteRegex = /\W/g;

router.get("/", route({ permission: "MANAGE_GUILD" }), async (req: Request, res: Response) => {
	const { guild_id } = req.params;

	const guild = await Guild.findOneOrFail({ where: { id: guild_id }, relations: ["vanity_url"] });
	if (!guild.vanity_url) return res.json({ code: null });

	return res.json({ code: guild.vanity_url_code, uses: guild.vanity_url.uses });
});

export interface VanityUrlSchema {
	/**
	 * @minLength 1
	 * @maxLength 20
	 */
	code?: string;
}

// TODO: check if guild is elgible for vanity url
router.patch("/", route({ body: "VanityUrlSchema", permission: "MANAGE_GUILD" }), async (req: Request, res: Response) => {
	const { guild_id } = req.params;
	const body = req.body as VanityUrlSchema;
	const code = body.code?.replace(InviteRegex, "");

	await Invite.findOneOrFail({ code });

	const guild = await Guild.findOneOrFail({ id: guild_id });
	const { id } = await Channel.findOneOrFail({ guild_id, type: ChannelType.GUILD_TEXT });
	guild.vanity_url_code = code;

	Promise.all([
		guild.save(),
		Invite.delete({ code: guild.vanity_url_code }),
		new Invite({
			code: code,
			uses: 0,
			created_at: new Date(),
			guild_id,
			channel_id: id
		}).save()
	]);

	return res.json({ code: code });
});

export default router;
