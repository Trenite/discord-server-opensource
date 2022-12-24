import {
	ApiError,
	Config,
	ConnectedAccount,
	ConnectedAccountCommonOAuthTokenResponse,
	ConnectionCallbackSchema,
	ConnectionLoader,
	DiscordApiErrors,
} from "@fosscord/util";
import fetch from "node-fetch";
import Connection from "../../util/connections/Connection";
import { EpicGamesSettings } from "./EpicGamesSettings";

export interface UserResponse {
	accountId: string;
	displayName: string;
	preferredLanguage: string;
}

export interface EpicTokenResponse
	extends ConnectedAccountCommonOAuthTokenResponse {
	expires_at: string;
	refresh_expires_in: number;
	refresh_expires_at: string;
	account_id: string;
	client_id: string;
	application_id: string;
}

export default class EpicGamesConnection extends Connection {
	public readonly id = "epicgames";
	public readonly authorizeUrl = "https://www.epicgames.com/id/authorize";
	public readonly tokenUrl = "https://api.epicgames.dev/epic/oauth/v1/token";
	public readonly userInfoUrl =
		"https://api.epicgames.dev/epic/id/v1/accounts";
	public readonly scopes = ["basic profile"];
	settings: EpicGamesSettings = new EpicGamesSettings();

	init(): void {
		this.settings = ConnectionLoader.getConnectionConfig(
			this.id,
			this.settings,
		) as EpicGamesSettings;
	}

	getAuthorizationUrl(userId: string): string {
		const state = this.createState(userId);
		const url = new URL(this.authorizeUrl);

		url.searchParams.append("client_id", this.settings.clientId!);
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
		return url.toString();
	}

	getTokenUrl(): string {
		return this.tokenUrl;
	}

	async exchangeCode(
		state: string,
		code: string,
	): Promise<EpicTokenResponse> {
		this.validateState(state);

		const url = this.getTokenUrl();

		return fetch(url.toString(), {
			method: "POST",
			headers: {
				Accept: "application/json",
				Authorization: `Basic ${Buffer.from(
					`${this.settings.clientId}:${this.settings.clientSecret}`,
				).toString("base64")}`,
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: new URLSearchParams({
				grant_type: "authorization_code",
				code,
			}),
		})
			.then((res) => {
				if (!res.ok) {
					throw new ApiError("Failed to exchange code", 0, 400);
				}

				return res.json();
			})
			.catch((e) => {
				console.error(
					`Error exchanging token for ${this.id} connection: ${e}`,
				);
				throw DiscordApiErrors.GENERAL_ERROR;
			});
	}

	async getUser(token: string): Promise<UserResponse[]> {
		const { sub } = JSON.parse(
			Buffer.from(token.split(".")[1], "base64").toString("utf8"),
		);
		const url = new URL(this.userInfoUrl);
		url.searchParams.append("accountId", sub);
		return fetch(url.toString(), {
			method: "GET",
			headers: {
				Authorization: `Bearer ${token}`,
			},
		})
			.then((res) => {
				if (!res.ok) {
					throw new ApiError("Failed to fetch user", 0, 400);
				}

				return res.json();
			})
			.catch((e) => {
				console.error(
					`Error fetching user for ${this.id} connection: ${e}`,
				);
				throw DiscordApiErrors.GENERAL_ERROR;
			});
	}

	async handleCallback(
		params: ConnectionCallbackSchema,
	): Promise<ConnectedAccount | null> {
		const userId = this.getUserId(params.state);
		const tokenData = await this.exchangeCode(params.state, params.code!);
		const userInfo = await this.getUser(tokenData.access_token);

		const exists = await this.hasConnection(userId, userInfo[0].accountId);

		if (exists) return null;

		return await this.createConnection({
			user_id: userId,
			external_id: userInfo[0].accountId,
			friend_sync: params.friend_sync,
			name: userInfo[0].displayName,
			type: this.id,
		});
	}
}
