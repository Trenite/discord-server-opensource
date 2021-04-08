import { GuildDeleteEvent, GuildMemberAddEvent, GuildMemberRemoveEvent, GuildModel, MemberModel, UserModel } from "fosscord-server-util";
import { HTTPError } from "lambert-server";
import Config from "./Config";
import { emitEvent } from "./Event";
import { getPublicUser } from "./User";

export const PublicMemberProjection = {
	id: true,
	guild_id: true,
	nick: true,
	roles: true,
	joined_at: true,
	pending: true,
	deaf: true,
	mute: true,
	premium_since: true,
};

export async function addMember(user_id: string, guild_id: string) {
	const user = await getPublicUser(user_id, { guilds: true });

	const guildSize = user.guilds.length;

	const { maxGuilds } = Config.get().limits.user;
	if (guildSize >= maxGuilds) {
		throw new HTTPError(`You are at the ${maxGuilds} server limit.`, 403);
	}

	const member = {
		id: user_id,
		guild_id: guild_id,
		nick: undefined,
		roles: [guild_id], // @everyone role
		joined_at: new Date(),
		premium_since: undefined,
		deaf: false,
		mute: false,
		pending: false,
	};

	return Promise.all([
		new MemberModel({
			...member,
			settings: {
				channel_overrides: [],
				message_notifications: 0,
				mobile_push: true,
				mute_config: null,
				muted: false,
				suppress_everyone: false,
				suppress_roles: false,
				version: 0,
			},
		}).save(),

		UserModel.updateOne({ id: user_id }, { $push: { guilds: guild_id } }).exec(),
		GuildModel.findOneAndUpdate({ id: guild_id }, { $inc: { member_count: 1 } }).exec(),

		emitEvent({
			event: "GUILD_MEMBER_ADD",
			data: {
				...member,
				user,
				guild_id,
			},
			guild_id,
		} as GuildMemberAddEvent),
	]);
}

export async function removeMember(user_id: string, guild_id: string) {
	const user = await getPublicUser(user_id);

	const guild = await GuildModel.findOne({ id: guild_id }, { owner_id: true }).exec();
	if (!guild) throw new HTTPError("Guild not found", 404);
	if (guild.owner_id === user_id) throw new Error("The owner cannot be removed of the guild");

	// use promise all to execute all promises at the same time -> save time
	return Promise.all([
		MemberModel.deleteOne({
			id: user_id,
			guild_id: guild_id,
		}).exec(),
		UserModel.updateOne({ id: user.id }, { $pull: { guilds: guild_id } }).exec(),
		GuildModel.updateOne({ id: guild_id }, { $inc: { member_count: -1 } }).exec(),

		emitEvent({
			event: "GUILD_DELETE",
			data: {
				id: guild_id,
			},
			user_id: user_id,
		} as GuildDeleteEvent),
		emitEvent({
			event: "GUILD_MEMBER_REMOVE",
			data: {
				guild_id: guild_id,
				user: user,
			},
			guild_id: guild_id,
		} as GuildMemberRemoveEvent),
	]);
}
