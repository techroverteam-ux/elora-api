import { UserDocument } from "../modules/user/user.model";
import { RoleDocument } from "../modules/role/role.model";

declare global {
  namespace Express {
    interface Request {
      // We explicitly say the user will have the Role populated
      user?: UserDocument & { role: RoleDocument };
    }
  }
}
