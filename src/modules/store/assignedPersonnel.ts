import { Request, Response } from "express";
import Store from "./store.model";
import User from "../user/user.model";
import { getClientScope, storeScopeFilter, userHasRole } from "../../utils/access";

const assignmentFields = {
  recceAssignedTo: "workflow.recceAssignedTo",
  installationAssignedTo: "workflow.installationAssignedTo",
} as const;

/** Add constraints without replacing an existing client or assignment restriction. */
export const applyAssignedPersonnelFilters = (query: any, params: any): string | null => {
  const conditions: any[] = [];
  for (const [param, field] of Object.entries(assignmentFields)) {
    const raw = params[param];
    if (raw === undefined || raw === "") continue;
    const values = Array.isArray(raw) ? raw : [raw];
    if (!values.every((value) => typeof value === "string")) {
      return `Invalid ${param}: select assigned personnel from the list.`;
    }
    const ids = [...new Set<string>(values.flatMap((value: string) => value.split(",").map((id) => id.trim())))];
    if (!ids.length || !ids.every((id) => /^[a-f\d]{24}$/i.test(id))) {
      return `Invalid ${param}: select assigned personnel from the list.`;
    }
    conditions.push({ [field]: { $in: ids } });
  }
  if (conditions.length) query.$and = [...(query.$and || []), ...conditions];
  return null;
};

/** Filter choices come from assigned stores, including past/inactive personnel. */
export const getAssignedPersonnel = async (req: Request, res: Response) => {
  try {
    if (!userHasRole(req.user, "SUPER_ADMIN", "ADMIN", "SUB_ADMIN")) {
      return res.status(403).json({ message: "Only admins can filter by assigned personnel." });
    }
    const stage = req.query.stage;
    if (stage !== "RECCE" && stage !== "INSTALLATION") {
      return res.status(400).json({ message: "Stage must be RECCE or INSTALLATION." });
    }
    const field = stage === "RECCE" ? assignmentFields.recceAssignedTo : assignmentFields.installationAssignedTo;
    const scope = await getClientScope(req);
    const ids = await Store.distinct(field, {
      ...storeScopeFilter(scope),
      [field]: { $ne: null },
    });
    const personnel = await User.find({ _id: { $in: ids } })
      .select("_id name email")
      .sort({ name: 1, _id: 1 })
      .lean();
    return res.json({ personnel });
  } catch (error) {
    console.error("Assigned personnel filter error:", error);
    return res.status(500).json({ message: "Failed to load assigned personnel." });
  }
};
