/*
	Fosscord: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2023 Fosscord and Fosscord Contributors
	
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

import { route } from "@fosscord/api";
import { ConnectedAccount, ConnectedAccountDTO } from "@fosscord/util";
import { Request, Response, Router } from "express";

const router: Router = Router();

router.get("/", route({}), async (req: Request, res: Response) => {
	const connections = await ConnectedAccount.find({
		where: {
			user_id: req.user_id,
		},
		select: [
			"external_id",
			"type",
			"name",
			"verified",
			"visibility",
			"show_activity",
			"revoked",
			"token_data",
			"friend_sync",
			"integrations",
		],
	});

	res.json(connections.map((x) => new ConnectedAccountDTO(x, true)));
});

export default router;
