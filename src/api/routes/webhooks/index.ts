/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2023 Spacebar and Spacebar Contributors
	
	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published
	by the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.
	
	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.
	
	You should have received a copy of the GNU Affero General Public License
	along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { route } from "@spacebar/api";
import { Webhook } from "@spacebar/util";
import { Request, Response, Router } from "express";
import { HTTPError } from "lambert-server";

const router: Router = Router();

router.get(
	"/:id",
	route({
		responses: {
			200: {
				body: "Webhook",
			},
			404: {},
		},
	}),
	async (req: Request, res: Response) => {
		const hook = await Webhook.findOneOrFail({
			where: {
				id: req.params.id,
			},
		}).catch(() => {
			throw new HTTPError("Webhook not found.", 404);
		});

		return res.json({
			...hook,
			user: hook.user,
		});
	},
);

router.get(
	"/:id/:token",
	route({
		responses: {
			200: {
				body: "Webhook",
			},
			404: {},
		},
	}),
	async (req: Request, res: Response) => {
		const hook = await Webhook.findOneOrFail({
			where: {
				id: req.params.id,
				token: req.params.token,
			},
		}).catch(() => {
			throw new HTTPError("Webhook not found.", 404);
		});

		return res.json({
			...hook,
		});
	},
);

export default router;
