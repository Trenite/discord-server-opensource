import { Router, Response, Request } from "express";
import { route } from "@fosscord/api";
import { Channel, Config, getPermission, trimSpecial, Webhook } from "@fosscord/util";
import { HTTPError } from "lambert-server";
import { isTextChannel } from "./messages/index";
import { DiscordApiErrors } from "@fosscord/util";

const router: Router = Router();
// TODO: webhooks
export interface WebhookCreateSchema {
	/**
	 * @maxLength 80
	 */
	name: string;
	avatar: string;
}

// TODO: use Image Data Type for avatar instead of String
router.post("/", route({ body: "WebhookCreateSchema", permission: "MANAGE_WEBHOOKS" }), async (req: Request, res: Response) => {
	const channel_id = req.params.channel_id;
	const channel = await Channel.findOneOrFail({ id: channel_id });

	isTextChannel(channel.type);
	if (!channel.guild_id) throw new HTTPError("Not a guild channel", 400);

	const webhook_count = await Webhook.count({ channel_id });
	const { maxWebhooks } = Config.get().limits.channel;
	if (webhook_count > maxWebhooks) throw DiscordApiErrors.MAXIMUM_WEBHOOKS.withParams(maxWebhooks);

	var { avatar, name } = req.body as { name: string; avatar?: string };
	name = trimSpecial(name);
	if (name === "clyde") throw new HTTPError("Invalid name", 400);

	// TODO: save webhook in database and send response
});

export default router;
