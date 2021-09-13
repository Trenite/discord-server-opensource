import { Request, Response, Router } from "express";
import { emitEvent, getPermission, Guild, GuildUpdateEvent, Member } from "@fosscord/util";
import { HTTPError } from "lambert-server";
import { route } from "@fosscord/api";
import { handleFile } from "@fosscord/api";
import "missing-native-js-functions";
import { GuildCreateSchema } from "../index";

const router = Router();

export interface GuildUpdateSchema extends Omit<GuildCreateSchema, "channels"> {
	banner?: string;
	splash?: string;
	description?: string;
	features?: string[];
	verification_level?: number;
	default_message_notifications?: number;
	system_channel_flags?: number;
	explicit_content_filter?: number;
	public_updates_channel_id?: string;
	afk_timeout?: number;
	afk_channel_id?: string;
	preferred_locale?: string;
}

router.get("/", route({}), async (req: Request, res: Response) => {
	const { guild_id } = req.params;

	const [guild, member] = await Promise.all([
		Guild.findOneOrFail({ id: guild_id }),
		Member.findOne({ guild_id: guild_id, id: req.user_id })
	]);
	if (!member) throw new HTTPError("You are not a member of the guild you are trying to access", 401);

	// @ts-ignore
	guild.joined_at = member?.joined_at;

	return res.json(guild);
});

router.patch("/", route({ body: "GuildUpdateSchema", permission: "MANAGE_GUILD" }), async (req: Request, res: Response) => {
	const body = req.body as GuildUpdateSchema;
	const { guild_id } = req.params;
	// TODO: guild update check image

	if (body.icon) body.icon = await handleFile(`/icons/${guild_id}`, body.icon);
	if (body.banner) body.banner = await handleFile(`/banners/${guild_id}`, body.banner);
	if (body.splash) body.splash = await handleFile(`/splashes/${guild_id}`, body.splash);

	var guild = await Guild.findOneOrFail({
		where: { id: guild_id },
		relations: ["emojis", "roles", "stickers"]
	});
	// TODO: check if body ids are valid
	guild.assign(body);

	const data = guild.toJSON();
	// TODO: guild hashes
	// TODO: fix vanity_url_code, template_id
	delete data.vanity_url_code;
	delete data.template_id;

	await Promise.all([guild.save(), emitEvent({ event: "GUILD_UPDATE", data, guild_id } as GuildUpdateEvent)]);

	return res.json(data);
});

export default router;
