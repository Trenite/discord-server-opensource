import { Router, Request, Response } from "express";
import { check, Email, EMAIL_REGEX, FieldErrors, Length } from "../../util/instanceOf";
import { trimSpecial, Application, Snowflake, UserModel, Config, ApplicationCommandOptionType } from "@fosscord/util";
const User = require("../../util/User")

const router: Router = Router();

router.post(
	"/", 
	check({
		name: new Length(String, 2, 32),
		team_id: Number
	}),
	//TODO to get finished
	async (req: Request, res: Response) => {
		const user = User.getPublicUser(req.user_id);
		const {
			name,
			team_id
		} = req.body;
		const application: Application = {
			id: Snowflake.generate(),
			name: name,
			icon: null,
			description: "",
			rpc_origins: null,
			bot_public: true,
			bot_require_code_grant: false,
			terms_of_service_url: null,
			privacy_policy_url: null,
			owner_id: user.id,
			summary: null,
			verify_key: "",
			team: null,
			guild_id: "",
			primary_sku_id: null,
			slug: null,
			cover_image: null,
			flags: 0
		}
		res.json(await {id: application.id, name: application.name, icon: application.icon, description: "", summary: "", hook: true, verify_key: "a6b61d53d5eb9c9623f6536ceffd9781336635ad736b1d8bc501741f77eb12f9", owner: {id: application.owner_id, username: user.name, avatar: user.avatar, discriminator: user.discriminator, public_flags: user.public_flags, flags: user.flags}, flags: 0, secret: "sYsrGx-iJqk0MQefkWjI1EsP8_zMNs9s", redirect_uris: [], rpc_application_state: 0, store_application_state: 1, verification_state: 1, interactions_endpoint_url: null, integration_public: true, integration_require_code_grant: false});
		res.status(201)
	}
);
export default router;