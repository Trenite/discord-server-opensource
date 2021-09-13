import { CLOSECODES, Payload, OPCODES } from "@fosscord/gateway/util/Constants";
import WebSocket from "@fosscord/gateway/util/WebSocket";
import {
	Channel,
	checkToken,
	Guild,
	Intents,
	Member,
	ReadyEventData,
	User,
	Session,
	EVENTEnum,
	Config,
	dbConnection,
	PublicMemberProjection,
	PublicMember,
	ChannelType,
	PublicUser,
} from "@fosscord/util";
import { setupListener } from "../listener/listener";
import { IdentifySchema } from "../schema/Identify";
import { Send } from "@fosscord/gateway/util/Send";
// import experiments from "./experiments.json";
const experiments: any = [];
import { check } from "./instanceOf";
import { Recipient } from "@fosscord/util";
import { genSessionId } from "@fosscord/gateway/util/SessionUtils";

// TODO: bot sharding
// TODO: check priviliged intents
// TODO: check if already identified

export async function onIdentify(this: WebSocket, data: Payload) {
	clearTimeout(this.readyTimeout);
	check.call(this, IdentifySchema, data.d);

	const identify: IdentifySchema = data.d;

	try {
		const { jwtSecret } = Config.get().security;
		var { decoded } = await checkToken(identify.token, jwtSecret); // will throw an error if invalid
	} catch (error) {
		console.error("invalid token", error);
		return this.close(CLOSECODES.Authentication_failed);
	}
	this.user_id = decoded.id;
	if (!identify.intents) identify.intents = 0b11111111111111n;
	this.intents = new Intents(identify.intents);
	if (identify.shard) {
		this.shard_id = identify.shard[0];
		this.shard_count = identify.shard[1];
		if (
			this.shard_count == null ||
			this.shard_id == null ||
			this.shard_id >= this.shard_count ||
			this.shard_id < 0 ||
			this.shard_count <= 0
		) {
			console.log(identify.shard);
			return this.close(CLOSECODES.Invalid_shard);
		}
	}
	var users: PublicUser[] = [];

	const members = await Member.find({
		where: { id: this.user_id },
		relations: [
			"guild",
			"guild.channels",
			"guild.emojis",
			"guild.roles",
			"guild.stickers",
			"user",
			"roles",
		],
	});
	const merged_members = members.map((x: Member) => {
		return [
			{
				...x,
				roles: x.roles.map((x) => x.id),
				settings: undefined,
				guild: undefined,
			},
		];
	}) as PublicMember[][];
	const guilds = members.map((x) => ({ ...x.guild, joined_at: x.joined_at }));
	const user_guild_settings_entries = members.map((x) => x.settings);

	const recipients = await Recipient.find({
		where: { user_id: this.user_id },
		relations: ["channel", "channel.recipients", "channel.recipients.user"],
		// TODO: public user selection
	});
	const channels = recipients.map((x) => {
		// @ts-ignore
		x.channel.recipients = x.channel.recipients?.map((x) => x.user);
		// @ts-ignore
		users = users.concat(x.channel.recipients);
		if (x.channel.type === ChannelType.DM) {
			x.channel.recipients = [
				// @ts-ignore
				x.channel.recipients.find((x) => x.id !== this.user_id),
			];
		}
		return x.channel;
	});
	const user = await User.findOneOrFail({
		where: { id: this.user_id },
		relations: ["relationships", "relationships.to"],
	});
	if (!user) return this.close(CLOSECODES.Authentication_failed);

	const public_user = {
		username: user.username,
		discriminator: user.discriminator,
		id: user.id,
		public_flags: user.public_flags,
		avatar: user.avatar,
		bot: user.bot,
		bio: user.bio,
	};
	users.push(public_user);

	const session_id = genSessionId();
	this.session_id = session_id; //Set the session of the WebSocket object
	const session = new Session({
		user_id: this.user_id,
		session_id: session_id,
		status: "online", //does the session always start as online?
		client_info: {
			//TODO read from identity
			client: "desktop",
			os: "linux",
			version: 0,
		},
	});

	//We save the session and we delete it when the websocket is closed
	await session.save();

	const privateUser = {
		avatar: user.avatar,
		mobile: user.mobile,
		desktop: user.desktop,
		discriminator: user.discriminator,
		email: user.email,
		flags: user.flags,
		id: user.id,
		mfa_enabled: user.mfa_enabled,
		nsfw_allowed: user.nsfw_allowed,
		phone: user.phone,
		premium: user.premium,
		premium_type: user.premium_type,
		public_flags: user.public_flags,
		username: user.username,
		verified: user.verified,
		bot: user.bot,
		accent_color: user.accent_color || 0,
		banner: user.banner,
		bio: user.bio,
	};

	const d: ReadyEventData = {
		v: 8,
		user: privateUser,
		user_settings: user.settings,
		// @ts-ignore
		guilds: guilds.map((x) => {
			// @ts-ignore
			x.guild_hashes = {}; // @ts-ignore
			x.guild_scheduled_events = []; // @ts-ignore
			x.threads = [];
			return x;
		}),
		guild_experiments: [], // TODO
		geo_ordered_rtc_regions: [], // TODO
		relationships: user.relationships.map((x) => x.toPublicRelationship()),
		read_state: {
			// TODO
			entries: [],
			partial: false,
			version: 304128,
		},
		user_guild_settings: {
			entries: user_guild_settings_entries,
			partial: false, // TODO partial
			version: 642,
		},
		private_channels: channels,
		session_id: session_id,
		analytics_token: "", // TODO
		connected_accounts: [], // TODO
		consents: {
			personalization: {
				consented: false, // TODO
			},
		},
		country_code: user.settings.locale,
		friend_suggestion_count: 0, // TODO
		// @ts-ignore
		experiments: experiments, // TODO
		guild_join_requests: [], // TODO what is this?
		users: users.unique(), // TODO
		merged_members: merged_members,
		// shard // TODO: only for bots sharding
		// application // TODO for applications
	};

	console.log("Send ready");

	// TODO: send real proper data structure
	await Send(this, {
		op: OPCODES.Dispatch,
		t: EVENTEnum.Ready,
		s: this.sequence++,
		d,
	});

	//TODO send READY_SUPPLEMENTAL
	//TODO send GUILD_MEMBER_LIST_UPDATE
	//TODO send SESSIONS_REPLACE
	//TODO send VOICE_STATE_UPDATE to let the client know if another device is already connected to a voice channel

	await setupListener.call(this);
}
