import { ConnectedAccount } from "../entities";

export class ConnectedAccountDTO {
	id: string;
	user_id: string;
	access_token?: string;
	friend_sync: boolean;
	name: string;
	revoked: boolean;
	show_activity: boolean;
	type: string;
	verified: boolean;
	visibility: number;
	integrations: string[];

	constructor(connectedAccount: ConnectedAccount, with_token: boolean = false) {
		this.id = connectedAccount.external_id;
		this.user_id = connectedAccount.user_id;
		this.access_token = connectedAccount.access_token && with_token ? connectedAccount.access_token : undefined;
		this.friend_sync = connectedAccount.friend_sync;
		this.name = connectedAccount.name;
		this.revoked = connectedAccount.revoked;
		this.show_activity = connectedAccount.show_activity;
		this.type = connectedAccount.type;
		this.verified = connectedAccount.verified;
		this.visibility = connectedAccount.visibility;
		this.integrations = connectedAccount.integrations;
	}
}
