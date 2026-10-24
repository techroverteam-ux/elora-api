import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import Client from "../modules/client/client.model";
import Store from "../modules/store/store.model";

// ---------------------------------------------------------------------------
// Role + client-scope helpers.
//
// SUB_ADMIN has the same rights as SUPER_ADMIN, but only over the stores of
// the clients mapped to them (User.assignedClients). Stores with no client
// are visible to Super Admin only.
// ---------------------------------------------------------------------------

// Compare letters/digits only, so "SUB_ADMIN", "Sub Admin", "sub-admin" and
// "SubAdmin" all match.
const squash = (v: any) => String(v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

export const roleKeys = (role: any): string[] =>
  [role?.code, role?.name].filter(Boolean).map(squash);

export const userHasRole = (user: any, ...wanted: string[]) =>
  (user?.roles || []).some((r: any) => roleKeys(r).some((k) => wanted.map(squash).includes(k)));

export const isSuperAdminUser = (user: any) => userHasRole(user, "SUPER_ADMIN");

/** Sub Admin who is not also a Super Admin (Super Admin always wins). */
export const isSubAdminUser = (user: any) => !isSuperAdminUser(user) && userHasRole(user, "SUB_ADMIN");

export interface ClientScope {
  ids: mongoose.Types.ObjectId[];
  codes: string[];
}

/**
 * The clients this request may see. `null` means no client restriction
 * (everyone except Sub Admin — other roles keep their existing rules).
 * Cached on the request.
 */
export const getClientScope = async (req: any): Promise<ClientScope | null> => {
  const user = req?.user;
  if (!user || !isSubAdminUser(user)) return null;
  if (req._clientScope) return req._clientScope;

  const ids = (user.assignedClients || []).map((c: any) => c?._id ?? c).filter(Boolean);
  const clients: any[] = ids.length
    ? await Client.find({ _id: { $in: ids } }).select("_id clientCode").lean()
    : [];

  const scope: ClientScope = {
    ids: clients.map((c) => c._id),
    codes: clients.map((c) => c.clientCode).filter(Boolean),
  };
  req._clientScope = scope;
  return scope;
};

/** Mongo condition matching stores of the scoped clients. Empty scope matches nothing. */
export const storeScopeCondition = (scope: ClientScope) => ({
  $or: [{ clientId: { $in: scope.ids } }, { clientCode: { $in: scope.codes } }],
});

/**
 * Filter to spread into a Store query / $match. Uses $and so it never
 * clobbers a caller's own $or. Returns {} when unrestricted.
 */
export const storeScopeFilter = (scope: ClientScope | null): any =>
  scope ? { $and: [storeScopeCondition(scope)] } : {};

/** Adds the scope to an existing query object in place (appends to $and). */
export const applyStoreScope = (query: any, scope: ClientScope | null) => {
  if (!scope) return query;
  query.$and = [...(query.$and || []), storeScopeCondition(scope)];
  return query;
};

export const isClientInScope = (scope: ClientScope | null, clientIdOrCode: any) => {
  if (!scope) return true;
  if (!clientIdOrCode) return false;
  const v = String(clientIdOrCode?._id ?? clientIdOrCode);
  return scope.ids.some((id) => String(id) === v) || scope.codes.includes(v);
};

export const isStoreInScope = (scope: ClientScope | null, store: any) => {
  if (!scope) return true;
  if (!store) return false;
  return isClientInScope(scope, store.clientId) || isClientInScope(scope, store.clientCode);
};

/** router.param("id") guard: a Sub Admin gets 404 for stores outside their clients. */
export const storeIdParamGuard = async (req: any, res: Response, next: NextFunction, id: string) => {
  try {
    const scope = await getClientScope(req);
    if (!scope || !mongoose.isValidObjectId(id)) return next();
    const ok = await Store.exists({ _id: id, ...storeScopeFilter(scope) });
    if (!ok) {
      res.status(404).json({ message: "Store not found" });
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
};

/** Body guard for bulk routes: every id in req.body.storeIds must be in scope. */
export const requireStoreIdsInScope = async (req: any, res: Response, next: NextFunction) => {
  try {
    const scope = await getClientScope(req);
    const raw = req.body?.storeIds;
    if (!scope || !Array.isArray(raw) || raw.length === 0) return next();

    const ids = Array.from(new Set(raw.map(String))).filter((id) => mongoose.isValidObjectId(id));
    const inScope = await Store.countDocuments({ _id: { $in: ids }, ...storeScopeFilter(scope) });
    if (inScope !== ids.length) {
      res.status(403).json({ message: "Some selected stores belong to clients that are not assigned to you." });
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
};

/** Only Super Admin can map clients to users or hand out admin roles. */
export const SUPER_ADMIN_ONLY_ROLE_CODES = ["SUPER_ADMIN", "SUB_ADMIN"];

/**
 * Modules a Sub Admin never gets, whatever their role grid says. Element
 * *reads* stay open (client and store forms need the element list); only
 * element create/edit/delete is blocked.
 */
export const SUB_ADMIN_BLOCKED_MODULES = ["users", "roles", "elements"];

/** Route guard: refuse Sub Admins (used on element create/edit/delete). */
export const denySubAdmin = (req: any, res: Response, next: NextFunction) => {
  if (isSubAdminUser(req.user)) {
    res.status(403).json({ message: "Sub Admins don't have access to this module." });
    return;
  }
  next();
};
