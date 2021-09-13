import { Router, Request, Response } from "express";
import { User, PrivateUserProjection } from "@fosscord/util";
import { route } from "@fosscord/api";
import { handleFile } from "@fosscord/api";

const router: Router = Router();

export interface UserModifySchema {
	/**
	 * @minLength 1
	 * @maxLength 100
	 */
	username?: string;
	avatar?: string | null;
	/**
	 * @maxLength 1024
	 */
	bio?: string;
	accent_color?: number | null;
	banner?: string | null;
	password?: string;
	new_password?: string;
	code?: string;
}

router.get("/", async (req: Request, res: Response) => {
	res.json(await User.findOne({ select: PrivateUserProjection, where: { id: req.user_id } }));
});

router.patch("/", route({ body: "UserModifySchema" }), async (req: Request, res: Response) => {
	const body = req.body as UserModifySchema;

	if (body.avatar) body.avatar = await handleFile(`/avatars/${req.user_id}`, body.avatar as string);
	if (body.banner) body.banner = await handleFile(`/banners/${req.user_id}`, body.banner as string);

	const user = await new User({ ...body, id: req.user_id }).save();
	// TODO: dispatch user update event

	res.json(user);
});

export async function generateToken(id: string) {
	const iat = Math.floor(Date.now() / 1000);
	const algorithm = "HS256";

	return new Promise((res, rej) => {
		jwt.sign(
			{ id: id, iat },
			Config.get().security.jwtSecret,
			{
				algorithm
			},
			(err, token) => {
				if (err) return rej(err);
				return res(token);
			}
		);
	});
}

export default router;
// {"message": "Invalid two-factor code", "code": 60008}
