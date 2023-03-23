import { PublicConnectedAccount, UserPublic } from "../../entities";

export interface UserProfileResponse {
	user: UserPublic;
	connected_accounts: PublicConnectedAccount;
	premium_guild_since?: Date;
	premium_since?: Date;
}
