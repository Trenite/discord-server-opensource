import { Router, Request, Response } from "express";
import { RoleModel, GuildModel, Snowflake, Guild, GuildCreateEvent, toObject } from "fosscord-server-util";
import { HTTPError } from "lambert-server";
import { check } from "./../../util/instanceOf";
import { GuildCreateSchema } from "../../schema/Guild";
import Config from "../../util/Config";
import { getPublicUser } from "../../util/User";
import { emitEvent } from "../../util/Event";
import { addMember, PublicMemberProjection } from "../../util/Member";

const router: Router = Router();

router.post("/", check(GuildCreateSchema), async (req: Request, res: Response) => {
	const body = req.body as GuildCreateSchema;

	const { maxGuilds } = Config.get().limits.user;
	const user = await getPublicUser(req.user_id, { guilds: true });

	if (user.guilds.length >= maxGuilds) {
		throw new HTTPError(`Maximum number of guilds reached ${maxGuilds}`, 403);
	}

	const guild_id = Snowflake.generate();
	const guild: Guild = {
		name: body.name,
		region: body.region || "en-US",
		owner_id: req.user_id,
		icon: undefined,
		afk_channel_id: undefined,
		afk_timeout: 300,
		application_id: undefined,
		banner: undefined,
		default_message_notifications: 0,
		description: undefined,
		splash: undefined,
		discovery_splash: undefined,
		explicit_content_filter: 0,
		features: [],
		id: guild_id,
		large: undefined,
		max_members: 250000,
		max_presences: 250000,
		max_video_channel_users: 25,
		presence_count: 0,
		member_count: 0, // will automatically be increased by addMember()
		mfa_level: 0,
		preferred_locale: "en-US",
		premium_subscription_count: 0,
		premium_tier: 0,
		public_updates_channel_id: undefined,
		rules_channel_id: undefined,
		system_channel_flags: 0,
		system_channel_id: undefined,
		unavailable: false,
		vanity_url_code: undefined,
		verification_level: 0,
		welcome_screen: [],
		widget_channel_id: undefined,
		widget_enabled: false,
	};

	await Promise.all([
		new GuildModel(guild).save(),
		new RoleModel({
			id: guild_id,
			guild_id: guild_id,
			color: 0,
			hoist: false,
			managed: true,
			mentionable: true,
			name: "@everyone",
			permissions: 2251804225n,
			position: 0,
			tags: null,
		}).save(),
	]);

	const [, , updated] = await addMember(req.user_id, guild_id);

	const data = toObject(await GuildModel.populate(updated, [{ path: "members", select: PublicMemberProjection }, { path: "joined_at" }]));

	emitEvent({
		event: "GUILD_CREATE",
		data,
		guild_id,
	} as GuildCreateEvent);

	res.status(201).json({ id: guild.id });
});

export default router;
