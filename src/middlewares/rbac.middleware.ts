import { Request, Response, NextFunction } from "express";

/**
 * Checks if the user has at least ONE role that grants the required permission.
 * * @param resource - The key in your permissions map (e.g., 'users', 'roles')
 * @param action - The specific flag ('view', 'create', 'edit', 'delete')
 */
export const checkPermission = (
  resource: string,
  action: "view" | "create" | "edit" | "delete",
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // 1. Basic Check: Does user exist and have roles?
      if (
        !req.user ||
        !req.user.roles ||
        !Array.isArray(req.user.roles) ||
        req.user.roles.length === 0
      ) {
        res.status(403).json({ message: "Access denied. No roles assigned." });
        return;
      }

      let isAuthorized = false;

      // 2. Loop through ALL assigned roles
      for (const role of req.user.roles) {
        // Ensure role has permissions property
        if (!role.permissions) continue;

        // Mongoose Map: Use .get() to access the resource
        const resourcePermission = role.permissions.get(resource);

        // If permission exists for this resource AND the specific action is true
        if (resourcePermission && resourcePermission[action] === true) {
          isAuthorized = true;
          break; // Stop looking, we found a valid role!
        }
      }

      // 3. Final Decision
      if (!isAuthorized) {
        res.status(403).json({
          message: `Access denied. None of your assigned roles permit '${action}' on '${resource}'.`,
        });
        return;
      }

      next();
    } catch (error) {
      console.error("RBAC Middleware Error:", error);
      res
        .status(500)
        .json({ message: "Internal Server Error during authorization" });
    }
  };
};
