import { NextFunction, Request, Response } from "express";
import { HTTPError } from "lambert-server";
import { checkToken, Config } from "@fosscord/util";

export const NO_AUTHORIZATION_ROUTES = [
	"/auth/login",
	"/auth/register",
	"/webhooks/",
	"/ping",
	"/gateway",
	"/experiments",
	"/download"
	/\/guilds\/\d+\/widget\.(json|png)/
];

export const API_PREFIX = /^\/api(\/v\d+)?/;
export const API_PREFIX_TRAILING_SLASH = /^\/api(\/v\d+)?\//;

declare global {
	namespace Express {
		interface Request {
			user_id: string;
			user_bot: boolean;
			token: string;
		}
	}
}

export async function Authentication(req: Request, res: Response, next: NextFunction) {
	if (req.method === "OPTIONS") return res.sendStatus(204);
	const url = req.url.replace(API_PREFIX, "");
	if (url.startsWith("/invites") && req.method === "GET") return next();
	if (
		NO_AUTHORIZATION_ROUTES.some((x) => {
			if (typeof x === "string") return url.startsWith(x);
			return x.test(url);
		})
	)
		return next();
	if (!req.headers.authorization) return next(new HTTPError("Missing Authorization Header", 401));

	try {
		const { jwtSecret } = Config.get().security;

		const { decoded, user }: any = await checkToken(req.headers.authorization, jwtSecret);

		req.token = decoded;
		req.user_id = decoded.id;
		req.user_bot = user.bot;
		return next();
	} catch (error: any) {
		return next(new HTTPError(error?.toString(), 400));
	}
}
