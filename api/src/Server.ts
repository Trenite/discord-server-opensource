import "missing-native-js-functions";
import { Connection } from "mongoose";
import { Server, ServerOptions } from "lambert-server";
import { Authentication, CORS } from "./middlewares/";
import { Config, initDatabase, initEvent } from "@fosscord/util";
import { ErrorHandler } from "./middlewares/ErrorHandler";
import { BodyParser } from "./middlewares/BodyParser";
import { Router, Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import path from "path";
import { initRateLimits } from "./middlewares/RateLimit";
import TestClient from "./middlewares/TestClient";
import ApplicationsClient from "./middlewares/ApplicationsClient";
import { initTranslation } from "./middlewares/Translation";

export interface FosscordServerOptions extends ServerOptions {}

declare global {
	namespace Express {
		interface Request {
			// @ts-ignore
			server: FosscordServer;
		}
	}
}

export class FosscordServer extends Server {
	public declare options: FosscordServerOptions;

	constructor(opts?: Partial<FosscordServerOptions>) {
		// @ts-ignore
		super({ ...opts, errorHandler: false, jsonBody: false });
	}

	async start() {
		await initDatabase();
		await Config.init();
		await initEvent();

		this.app.use(CORS);
		this.app.use(BodyParser({ inflate: true, limit: "10mb" }));

		const app = this.app;
		const api = Router(); // @ts-ignore
		this.app = api;

		api.use(Authentication);
		await initRateLimits(api);
		await initTranslation(api);

		this.routes = await this.registerRoutes(path.join(__dirname, "routes", "/"));

		api.use("*", (error: any, req: Request, res: Response, next: NextFunction) => {
			if (error) return next(error);
			res.status(404).json({
				message: "404: Not Found",
				code: 0
			});
			next();
		});

		this.app = app;
		app.use("/api/v8", api);
		app.use("/api/v9", api);
		app.use("/api", api); // allow unversioned requests
		this.app.use(ErrorHandler);
		ApplicationsClient(this.app);
		TestClient(this.app);

		return super.start();
	}
}
