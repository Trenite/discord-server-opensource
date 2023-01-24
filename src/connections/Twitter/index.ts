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

import {
	Config,
	ConnectedAccount,
	ConnectedAccountCommonOAuthTokenResponse,
	ConnectionCallbackSchema,
	ConnectionLoader,
	DiscordApiErrors,
} from "@fosscord/util";
import wretch from "wretch";
import RefreshableConnection from "../../util/connections/RefreshableConnection";
import { TwitterSettings } from "./TwitterSettings";

interface TwitterUserResponse {
	data: {
		id: string;
		name: string;
		username: string;
		created_at: string;
		location: string;
		url: string;
		description: string;
		verified: string;
	};
}

// interface TwitterErrorResponse {
// 	error: string;
// 	error_description: string;
// }

export default class TwitterConnection extends RefreshableConnection {
	public readonly id = "twitter";
	public readonly authorizeUrl = "https://twitter.com/i/oauth2/authorize";
	public readonly tokenUrl = "https://api.twitter.com/2/oauth2/token";
	public readonly userInfoUrl =
		"https://api.twitter.com/2/users/me?user.fields=created_at%2Cdescription%2Cid%2Cname%2Cusername%2Cverified%2Clocation%2Curl";
	public readonly scopes = ["users.read", "tweet.read"];
	settings: TwitterSettings = new TwitterSettings();

	init(): void {
		this.settings = ConnectionLoader.getConnectionConfig(
			this.id,
			this.settings,
		) as TwitterSettings;
	}

	getAuthorizationUrl(userId: string): string {
		if (!this.settings.clientId)
			throw new Error("Connection clientId must not be null");

		const state = this.createState(userId);
		const url = new URL(this.authorizeUrl);

		url.searchParams.append("client_id", this.settings.clientId);
		// TODO: probably shouldn't rely on cdn as this could be different from what we actually want. we should have an api endpoint setting.
		url.searchParams.append(
			"redirect_uri",
			`${
				Config.get().cdn.endpointPrivate || "http://localhost:3001"
			}/connections/${this.id}/callback`,
		);
		url.searchParams.append("response_type", "code");
		url.searchParams.append("scope", this.scopes.join(" "));
		url.searchParams.append("state", state);
		url.searchParams.append("code_challenge", "challenge"); // TODO: properly use PKCE challenge
		url.searchParams.append("code_challenge_method", "plain");
		return url.toString();
	}

	getTokenUrl(): string {
		return this.tokenUrl;
	}

	async exchangeCode(
		state: string,
		code: string,
	): Promise<ConnectedAccountCommonOAuthTokenResponse> {
		if (!this.settings.clientId)
			throw new Error("Connection clientId must not be null");
		if (!this.settings.clientSecret)
			throw new Error("Connection clientSecret must not be null");

		this.validateState(state);
		const url = this.getTokenUrl();

		return wretch(url.toString())
			.headers({
				Accept: "application/json",
				"Content-Type": "application/x-www-form-urlencoded",
				Authorization: `Basic ${Buffer.from(
					`${this.settings.clientId}:${this.settings.clientSecret}`,
				).toString("base64")}`,
			})
			.body(
				new URLSearchParams({
					grant_type: "authorization_code",
					code: code,
					client_id: this.settings.clientId,
					redirect_uri: `${
						Config.get().cdn.endpointPrivate ||
						"http://localhost:3001"
					}/connections/${this.id}/callback`,
					code_verifier: "challenge", // TODO: properly use PKCE challenge
				}),
			)
			.post()
			.json<ConnectedAccountCommonOAuthTokenResponse>()
			.catch((e) => {
				console.error(e);
				throw DiscordApiErrors.GENERAL_ERROR;
			});
	}

	async refreshToken(
		connectedAccount: ConnectedAccount,
	): Promise<ConnectedAccountCommonOAuthTokenResponse> {
		if (!this.settings.clientId)
			throw new Error("Connection clientId must not be null");
		if (!this.settings.clientSecret)
			throw new Error("Connection clientSecret must not be null");

		if (!connectedAccount.token_data?.refresh_token)
			throw new Error("No refresh token available.");
		const refresh_token = connectedAccount.token_data.refresh_token;

		const url = this.getTokenUrl();
		return wretch(url.toString())
			.headers({
				Accept: "application/json",
				"Content-Type": "application/x-www-form-urlencoded",
				Authorization: `Basic ${Buffer.from(
					`${this.settings.clientId}:${this.settings.clientSecret}`,
				).toString("base64")}`,
			})
			.body(
				new URLSearchParams({
					grant_type: "refresh_token",
					refresh_token,
					client_id: this.settings.clientId,
					redirect_uri: `${
						Config.get().cdn.endpointPrivate ||
						"http://localhost:3001"
					}/connections/${this.id}/callback`,
					code_verifier: "challenge", // TODO: properly use PKCE challenge
				}),
			)
			.post()
			.json<ConnectedAccountCommonOAuthTokenResponse>()
			.catch((e) => {
				console.error(e);
				throw DiscordApiErrors.GENERAL_ERROR;
			});
	}

	async getUser(token: string): Promise<TwitterUserResponse> {
		const url = new URL(this.userInfoUrl);
		return wretch(url.toString())
			.headers({
				Authorization: `Bearer ${token}`,
			})
			.get()
			.json<TwitterUserResponse>()
			.catch((e) => {
				console.error(e);
				throw DiscordApiErrors.GENERAL_ERROR;
			});
	}

	async handleCallback(
		params: ConnectionCallbackSchema,
	): Promise<ConnectedAccount | null> {
		if (!params.code)
			throw new Error("OAuth code is required for this connection");
		const userId = this.getUserId(params.state);
		const tokenData = await this.exchangeCode(params.state, params.code);
		const userInfo = await this.getUser(tokenData.access_token);

		const exists = await this.hasConnection(userId, userInfo.data.id);

		if (exists) return null;

		return await this.createConnection({
			token_data: { ...tokenData, fetched_at: Date.now() },
			user_id: userId,
			external_id: userInfo.data.id,
			friend_sync: params.friend_sync,
			name: userInfo.data.name,
			type: this.id,
		});
	}
}
