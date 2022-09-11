import { Column, Entity, JoinColumn, ManyToOne, OneToMany, RelationId } from "typeorm";
import { DmChannelDTO } from "../dtos";
import { ChannelCreateEvent, ChannelRecipientRemoveEvent, ThreadCreateEvent, ThreadMembersUpdateEvent } from "../interfaces";
import { ThreadMetadataSchema } from "../schemas/ThreadMetadataSchema";
import { Config, containsAll, DiscordApiErrors, emitEvent, getPermission, InvisibleCharacters, Snowflake, trimSpecial } from "../util";
import { HTTPError } from "../util/imports/HTTPError";
import { OrmUtils } from "../util/imports/OrmUtils";
import { BaseClass } from "./BaseClass";
import { Guild } from "./Guild";
import { Invite } from "./Invite";
import { Message } from "./Message";
import { ReadState } from "./ReadState";
import { Recipient } from "./Recipient";
import { ThreadMember } from "./ThreadMember";
import { PublicUserProjection, User } from "./User";
import { VoiceState } from "./VoiceState";
import { Webhook } from "./Webhook";

export enum ChannelType {
	GUILD_TEXT = 0, // a text channel within a guild
	DM = 1, // a direct message between users
	GUILD_VOICE = 2, // a voice channel within a guild
	GROUP_DM = 3, // a direct message between multiple users
	GUILD_CATEGORY = 4, // an organizational category that contains zero or more channels
	GUILD_NEWS = 5, // a channel that users can follow and crosspost into a guild or route
	GUILD_STORE = 6, // a channel in which game developers can sell their things
	ENCRYPTED = 7, // end-to-end encrypted channel
	ENCRYPTED_THREAD = 8, // end-to-end encrypted thread channel
	TRANSACTIONAL = 9, // event chain style transactional channel
	GUILD_NEWS_THREAD = 10, // a temporary sub-channel within a GUILD_NEWS channel
	GUILD_PUBLIC_THREAD = 11, // a temporary sub-channel within a GUILD_TEXT channel
	GUILD_PRIVATE_THREAD = 12, // a temporary sub-channel within a GUILD_TEXT channel that is only viewable by those invited and those with the MANAGE_THREADS permission
	GUILD_STAGE_VOICE = 13, // a voice channel for hosting events with an audience
	DIRECTORY = 14, // guild directory listing channel
	GUILD_FORUM = 15, // forum composed of IM threads
	TICKET_TRACKER = 33, // ticket tracker, individual ticket items shall have type 12
	KANBAN = 34, // confluence like kanban board
	VOICELESS_WHITEBOARD = 35, // whiteboard but without voice (whiteboard + voice is the same as stage)
	CUSTOM_START = 64, // start custom channel types from here
	UNHANDLED = 255 // unhandled unowned pass-through channel type
}

@Entity("channels")
export class Channel extends BaseClass {
	@Column()
	created_at: Date;

	@Column({ nullable: true })
	name?: string;

	@Column({ type: "text", nullable: true })
	icon?: string | null;

	@Column({ type: "int" })
	type: ChannelType;

	@OneToMany(() => Recipient, (recipient: Recipient) => recipient.channel, {
		cascade: true,
		orphanedRowAction: "delete"
	})
	recipients?: Recipient[];

	@Column({ nullable: true })
	last_message_id: string;

	@Column({ nullable: true })
	@RelationId((channel: Channel) => channel.guild)
	guild_id?: string;

	@JoinColumn({ name: "guild_id" })
	@ManyToOne(() => Guild, {
		onDelete: "CASCADE"
	})
	guild: Guild;

	@Column({ nullable: true })
	@RelationId((channel: Channel) => channel.parent)
	parent_id: string;

	@JoinColumn({ name: "parent_id" })
	@ManyToOne(() => Channel)
	parent?: Channel;

	// for group DMs and owned custom channel types
	@Column({ nullable: true })
	@RelationId((channel: Channel) => channel.owner)
	owner_id: string;

	@JoinColumn({ name: "owner_id" })
	@ManyToOne(() => User)
	owner: User;

	@Column({ nullable: true })
	last_pin_timestamp?: number;

	@Column({ nullable: true })
	default_auto_archive_duration?: number;

	@Column({ nullable: true })
	position?: number;

	@Column({ type: "simple-json", nullable: true })
	permission_overwrites?: ChannelPermissionOverwrite[];

	@Column({ nullable: true })
	video_quality_mode?: number;

	@Column({ nullable: true })
	bitrate?: number;

	@Column({ nullable: true })
	user_limit?: number;

	@Column({ nullable: true })
	nsfw?: boolean;

	@Column({ nullable: true })
	rate_limit_per_user?: number;

	@Column({ nullable: true })
	topic?: string;

	@OneToMany(() => Invite, (invite: Invite) => invite.channel, {
		cascade: true,
		orphanedRowAction: "delete"
	})
	invites?: Invite[];

	@Column({ nullable: true })
	retention_policy_id?: string;

	@OneToMany(() => Message, (message: Message) => message.channel, {
		cascade: true,
		orphanedRowAction: "delete"
	})
	messages?: Message[];

	@OneToMany(() => VoiceState, (voice_state: VoiceState) => voice_state.channel, {
		cascade: true,
		orphanedRowAction: "delete"
	})
	voice_states?: VoiceState[];

	@OneToMany(() => ReadState, (read_state: ReadState) => read_state.channel, {
		cascade: true,
		orphanedRowAction: "delete"
	})
	read_states?: ReadState[];

	@OneToMany(() => Webhook, (webhook: Webhook) => webhook.channel, {
		cascade: true,
		orphanedRowAction: "delete"
	})
	webhooks?: Webhook[];

	@Column({ nullable: true })
	flags?: number = 0;

	@Column({ nullable: true })
	default_thread_rate_limit_per_user?: number = 0;

	@Column({ nullable: true })
	member_count?: number = 0;

	@Column({ nullable: true })
	message_count?: number = 0;

	@Column({ nullable: true })
	total_message_sent?: number = 0;

	@Column({ nullable: true, type: "simple-json" })
	thread_metadata?: ThreadMetadataSchema;

	// TODO: DM channel
	static async createChannel(
		channel: Partial<Channel>,
		user_id: string = "0",
		opts?: {
			keepId?: boolean;
			skipExistsCheck?: boolean;
			skipPermissionCheck?: boolean;
			skipEventEmit?: boolean;
			skipNameChecks?: boolean;
		}
	) {
		if (!opts?.skipPermissionCheck) {
			// Always check if user has permission first
			const permissions = await getPermission(user_id, channel.guild_id);
			permissions.hasThrow("MANAGE_CHANNELS");
		}

		if (!opts?.skipNameChecks) {
			const guild = await Guild.findOneOrFail({ where: { id: channel.guild_id } });
			if (!guild.features.includes("ALLOW_INVALID_CHANNEL_NAMES") && channel.name) {
				for (let character of InvisibleCharacters)
					if (channel.name.includes(character)) throw new HTTPError("Channel name cannot include invalid characters", 403);

				// Categories and voice skip these checks on discord.com
				const skipChecksTypes = [ChannelType.GUILD_CATEGORY, ChannelType.GUILD_VOICE];
				if ((channel.type && !skipChecksTypes.includes(channel.type)) || guild.features.includes("IRC_LIKE_CHANNEL_NAMES")) {
					if (channel.name.includes(" ")) throw new HTTPError("Channel name cannot include invalid characters", 403);

					if (channel.name.match(/\-\-+/g)) throw new HTTPError("Channel name cannot include multiple adjacent dashes.", 403);

					if (channel.name.charAt(0) === "-" || channel.name.charAt(channel.name.length - 1) === "-")
						throw new HTTPError("Channel name cannot start/end with dash.", 403);
				} else channel.name = channel.name.trim(); //category names are trimmed client side on discord.com
			}

			if (!guild.features.includes("ALLOW_UNNAMED_CHANNELS")) {
				if (!channel.name) throw new HTTPError("Channel name cannot be empty.", 403);
			}
		}

		switch (channel.type) {
			case ChannelType.GUILD_TEXT:
			case ChannelType.GUILD_NEWS:
			case ChannelType.GUILD_VOICE:
			case ChannelType.GUILD_PUBLIC_THREAD:
			case ChannelType.GUILD_PRIVATE_THREAD:
			case ChannelType.GUILD_NEWS_THREAD:
				if (channel.parent_id && !opts?.skipExistsCheck) {
					const exists = await Channel.findOneOrFail({ where: { id: channel.parent_id } });
					if (!exists) throw new HTTPError("Parent id channel doesn't exist", 400);
					if (exists.guild_id !== channel.guild_id) throw new HTTPError("The category channel needs to be in the guild");
				}
				break;
			case ChannelType.GUILD_CATEGORY:
			case ChannelType.UNHANDLED:
				break;
			case ChannelType.DM:
			case ChannelType.GROUP_DM:
				throw new HTTPError("You can't create a dm channel in a guild");
			case ChannelType.GUILD_STORE:
			default:
				throw new HTTPError("Not yet supported");
		}

		if (!channel.permission_overwrites) channel.permission_overwrites = [];
		// TODO: eagerly auto generate position of all guild channels

		channel = {
			...channel,
			...(!opts?.keepId && { id: Snowflake.generate() }),
			created_at: new Date(),
			position: (channel.type === ChannelType.UNHANDLED ? 0 : channel.position) || 0,
			message_count: 0,
			member_count: 0,
			total_message_sent: 0
		};

		await Promise.all([
			OrmUtils.mergeDeep(new Channel(), channel).save(),
			!opts?.skipEventEmit
				? emitEvent({
						event: "CHANNEL_CREATE",
						data: channel,
						guild_id: channel.guild_id
				  } as ChannelCreateEvent)
				: Promise.resolve()
		]);

		return channel;
	}

	static async createThreadChannel(
		channel: Partial<Channel>,
		metadata: Partial<ThreadMetadataSchema>,
		user_id: string = "0",
		opts?: {
			keepId?: boolean;
			skipExistsCheck?: boolean;
			skipParentExistsCheck?: boolean;
			skipPermissionCheck?: boolean;
			skipEventEmit?: boolean;
			skipNameChecks?: boolean;
		}
	): Promise<Channel> {
		channel = {
			// set the default type to private
			type: ChannelType.GUILD_PRIVATE_THREAD,
			...channel,
			...(!opts?.keepId && { id: Snowflake.generate() }),
			created_at: new Date(),
			position: 0, // TODO:
			message_count: 0,
			member_count: 1,
			total_message_sent: 0
		};

		const exists = await Channel.findOne({
			where: {
				id: channel.id
			}
		});

		const guild = await Guild.findOneOrFail({ where: { id: channel.guild_id } });

		if (!opts?.skipExistsCheck && !guild.features.includes("ALLOW_EXISTING_THREAD_FOR_MESSAGE") && exists)
			throw DiscordApiErrors.THREAD_ALREADY_CREATED_FOR_THIS_MESSAGE;

		if (!channel.parent_id) throw new HTTPError("Parent id not set", 400);
		const parent = await Channel.findOneOrFail({ where: { id: channel.parent_id } });

		if (!opts?.skipPermissionCheck) {
			// Always check if user has permission first
			const permissions = await getPermission(user_id, parent.guild_id);
			permissions.hasThrow(
				channel.type === ChannelType.GUILD_PRIVATE_THREAD || channel.type === ChannelType.ENCRYPTED_THREAD
					? "CREATE_PRIVATE_THREADS"
					: "CREATE_PUBLIC_THREADS"
			);
		}

		channel = {
			...channel,
			permission_overwrites: parent.permission_overwrites,
			nsfw: parent.nsfw,
			owner_id: user_id,
			guild_id: parent.guild_id,
			thread_metadata: {
				create_timestamp: new Date(),
				archive_timestamp: new Date(),
				archived: false,
				auto_archive_duration: 0,
				invitable:
					channel.type === ChannelType.GUILD_NEWS_THREAD || channel.type === ChannelType.GUILD_PUBLIC_THREAD
						? Config.get().guild.publicThreadsInvitable
						: false,
				locked: false,
				...metadata
			}
		};

		if (!opts?.skipParentExistsCheck) {
			if (!parent) throw new HTTPError("Parent channel doesn't exist", 400);
			if (parent.guild_id !== channel.guild_id) throw new HTTPError("The category channel needs to be in the guild");
		}

		if (!opts?.skipNameChecks) {
			const guild = await Guild.findOneOrFail({ where: { id: channel.guild_id } });
			if (!guild.features.includes("ALLOW_INVALID_CHANNEL_NAMES") && channel.name) {
				for (let character of InvisibleCharacters)
					if (channel.name.includes(character)) throw new HTTPError("Channel name cannot include invalid characters", 403);

				channel.name = channel.name.trim(); //category names are trimmed client side on discord.com
			}

			if (!guild.features.includes("ALLOW_UNNAMED_CHANNELS")) {
				if (!channel.name) throw new HTTPError("Channel name cannot be empty.", 403);
			}
		}

		// TODO: eagerly auto generate position of all guild channels

		const thread = await OrmUtils.mergeDeep(new Channel(), channel).save();

		const member = {
			id: thread.id,
			user_id,
			join_timestamp: new Date(),
			muted: false,
			mute_config: null,
			flags: 0
		};
		if (channel.member_count) channel.member_count++;

		const threadMember = await OrmUtils.mergeDeep(new ThreadMember(), member).save();

		if (!opts?.skipEventEmit) {
			await Promise.all([
				emitEvent({
					event: "THREAD_CREATE",
					data: {
						...thread,
						newly_created: true
					},
					guild_id: channel.guild_id
				} as ThreadCreateEvent),
				emitEvent({
					event: "THREAD_MEMBERS_UPDATE",
					data: {
						guild_id: channel.guild_id,
						id: thread.id,
						member_count: channel.member_count,
						added_members: [threadMember],
						removed_member_ids: []
					},
					guild_id: channel.guild_id
				} as ThreadMembersUpdateEvent)
			]);
		}

		return thread;
	}

	static async createDMChannel(recipients: string[], creator_user_id: string, name?: string) {
		recipients = recipients.unique().filter((x) => x !== creator_user_id);
		const otherRecipientsUsers = await User.find({ where: recipients.map((x) => ({ id: x })) });

		// TODO: check config for max number of recipients
		/** if you want to disallow note to self channels, uncomment the conditional below
		if (otherRecipientsUsers.length !== recipients.length) {
			throw new HTTPError("Recipient/s not found");
		}
		**/

		const type = recipients.length > 1 ? ChannelType.GROUP_DM : ChannelType.DM;

		let channel = null;

		const channelRecipients = [...recipients, creator_user_id];

		const userRecipients = await Recipient.find({
			where: { user_id: creator_user_id },
			relations: ["channel", "channel.recipients"]
		});

		for (let ur of userRecipients) {
			let re = ur.channel.recipients!.map((r) => r.user_id);
			if (re.length === channelRecipients.length) {
				if (containsAll(re, channelRecipients)) {
					if (channel == null) {
						channel = ur.channel;
						ur = OrmUtils.mergeDeep(ur, { closed: false });
						await ur.save();
					}
				}
			}
		}

		if (channel == null) {
			name = trimSpecial(name);

			channel = await (
				OrmUtils.mergeDeep(new Channel(), {
					name,
					type,
					owner_id: type === ChannelType.DM ? undefined : null, // 1:1 DMs are ownerless in fosscord-server
					created_at: new Date(),
					last_message_id: null,
					recipients: channelRecipients.map((x) =>
						OrmUtils.mergeDeep(new Recipient(), {
							user_id: x,
							closed: !(type === ChannelType.GROUP_DM || x === creator_user_id)
						})
					)
				}) as Channel
			).save();
		}

		const channel_dto = await DmChannelDTO.from(channel);

		if (type === ChannelType.GROUP_DM) {
			for (let recipient of channel.recipients!) {
				await emitEvent({
					event: "CHANNEL_CREATE",
					data: channel_dto.excludedRecipients([recipient.user_id]),
					user_id: recipient.user_id
				});
			}
		} else {
			await emitEvent({ event: "CHANNEL_CREATE", data: channel_dto, user_id: creator_user_id });
		}

		if (recipients.length === 1) return channel_dto;
		else return channel_dto.excludedRecipients([creator_user_id]);
	}

	static async removeRecipientFromChannel(channel: Channel, user_id: string) {
		await Recipient.delete({ channel_id: channel.id, user_id: user_id });
		channel.recipients = channel.recipients?.filter((r) => r.user_id !== user_id);

		if (channel.recipients?.length === 0) {
			await Channel.deleteChannel(channel);
			await emitEvent({
				event: "CHANNEL_DELETE",
				data: await DmChannelDTO.from(channel, [user_id]),
				user_id: user_id
			});
			return;
		}

		await emitEvent({
			event: "CHANNEL_DELETE",
			data: await DmChannelDTO.from(channel, [user_id]),
			user_id: user_id
		});

		//If the owner leave the server user is the new owner
		if (channel.owner_id === user_id) {
			channel.owner_id = "1"; // The channel is now owned by the server user
			await emitEvent({
				event: "CHANNEL_UPDATE",
				data: await DmChannelDTO.from(channel, [user_id]),
				channel_id: channel.id
			});
		}

		await channel.save();

		await emitEvent({
			event: "CHANNEL_RECIPIENT_REMOVE",
			data: {
				channel_id: channel.id,
				user: await User.findOneOrFail({ where: { id: user_id }, select: PublicUserProjection })
			},
			channel_id: channel.id
		} as ChannelRecipientRemoveEvent);
	}

	static async deleteChannel(channel: Channel) {
		await Message.delete({ channel_id: channel.id }); //TODO we should also delete the attachments from the cdn but to do that we need to move cdn.ts in util
		//TODO before deleting the channel we should check and delete other relations
		await Channel.delete({ id: channel.id });
	}

	isDm() {
		return this.type === ChannelType.DM || this.type === ChannelType.GROUP_DM;
	}

	isThread() {
		return (
			this.type === ChannelType.ENCRYPTED_THREAD ||
			this.type === ChannelType.GUILD_NEWS_THREAD ||
			this.type === ChannelType.GUILD_PUBLIC_THREAD ||
			this.type === ChannelType.GUILD_PRIVATE_THREAD
		);
	}

	isPrivateThread() {
		return this.type === ChannelType.ENCRYPTED_THREAD || this.type === ChannelType.GUILD_PRIVATE_THREAD;
	}

	isPublicThread() {
		return this.type === ChannelType.GUILD_NEWS_THREAD || this.type === ChannelType.GUILD_PUBLIC_THREAD;
	}

	// Does the channel support sending messages ( eg categories do not )
	isWritable() {
		const disallowedChannelTypes = [ChannelType.GUILD_CATEGORY, ChannelType.GUILD_STAGE_VOICE, ChannelType.VOICELESS_WHITEBOARD];
		return disallowedChannelTypes.indexOf(this.type) == -1;
	}
}

export interface ChannelPermissionOverwrite {
	allow: string;
	deny: string;
	id: string;
	type: ChannelPermissionOverwriteType;
}

export enum ChannelPermissionOverwriteType {
	role = 0,
	member = 1,
	group = 2
}
