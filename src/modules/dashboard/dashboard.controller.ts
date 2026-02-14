import { Request, Response } from "express";
import Store, { StoreStatus } from "../store/store.model";
import User from "../user/user.model";

export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, status, zone, state } = req.query;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Build filter
    const filter: any = {};
    if (startDate && endDate) {
      filter.createdAt = { $gte: new Date(startDate as string), $lte: new Date(endDate as string) };
    }
    if (status) filter.currentStatus = status;
    if (zone) filter['location.zone'] = zone;
    if (state) filter['location.state'] = state;

    // KPI COUNTS
    const totalStores = await Store.countDocuments(filter);
    const newStoresToday = await Store.countDocuments({ ...filter, createdAt: { $gte: today } });
    
    const recceDoneTotal = await Store.countDocuments({
      ...filter,
      currentStatus: { $in: [StoreStatus.RECCE_SUBMITTED, StoreStatus.RECCE_APPROVED, StoreStatus.INSTALLATION_ASSIGNED, StoreStatus.INSTALLATION_SUBMITTED, StoreStatus.COMPLETED] }
    });
    const recceDoneToday = await Store.countDocuments({ ...filter, "recce.submittedDate": { $gte: today } });

    const installationDoneTotal = await Store.countDocuments({
      ...filter,
      currentStatus: { $in: [StoreStatus.INSTALLATION_SUBMITTED, StoreStatus.COMPLETED] }
    });
    const installationDoneToday = await Store.countDocuments({ ...filter, "installation.submittedDate": { $gte: today } });

    // Status breakdown
    const statusBreakdown = await Store.aggregate([
      { $match: filter },
      { $group: { _id: "$currentStatus", count: { $sum: 1 } } }
    ]);

    // Zone-wise distribution
    const zoneDistribution = await Store.aggregate([
      { $match: filter },
      { $group: { _id: "$location.zone", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // State-wise distribution
    const stateDistribution = await Store.aggregate([
      { $match: filter },
      { $group: { _id: "$location.state", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Monthly trend (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const monthlyTrend = await Store.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      { $group: {
        _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
        count: { $sum: 1 }
      }},
      { $sort: { _id: 1 } }
    ]);

    // Personnel stats
    const personnelStats = await User.aggregate([
      {
        $lookup: {
          from: "roles",
          localField: "roles",
          foreignField: "_id",
          as: "roleDetails",
        },
      },
      {
        $match: {
          "roleDetails.code": { $in: ["RECCE", "INSTALLATION"] },
          isActive: true,
        },
      },
      {
        $lookup: {
          from: "stores",
          let: { userId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ["$workflow.recceAssignedTo", "$$userId"] },
                    { $eq: ["$workflow.installationAssignedTo", "$$userId"] },
                  ],
                },
              },
            },
          ],
          as: "assignedStores",
        },
      },
      {
        $project: {
          name: 1,
          email: 1,
          role: { $arrayElemAt: ["$roleDetails.name", 0] },
          assignedCount: { $size: "$assignedStores" },
          completedCount: {
            $size: {
              $filter: {
                input: "$assignedStores",
                as: "store",
                cond: {
                   $or: [
                       { $and: [ { $eq: ["$$store.workflow.recceAssignedTo", "$_id"] }, { $in: ["$$store.currentStatus", ["RECCE_SUBMITTED", "RECCE_APPROVED", "COMPLETED"]] } ] },
                       { $and: [ { $eq: ["$$store.workflow.installationAssignedTo", "$_id"] }, { $in: ["$$store.currentStatus", ["INSTALLATION_SUBMITTED", "COMPLETED"]] } ] }
                   ]
                }
              }
            }
          }
        },
      },
    ]);

    // Recent stores
    const recentStores = await Store.find(filter)
      .sort({ createdAt: -1 })
      .limit(5)
      .select("storeName dealerCode location.city currentStatus createdAt");

    res.json({
      kpi: {
        totalStores,
        newStoresToday,
        recceDoneTotal,
        recceDoneToday,
        installationDoneTotal,
        installationDoneToday,
      },
      statusBreakdown,
      zoneDistribution,
      stateDistribution,
      monthlyTrend,
      personnelStats,
      recentStores,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch dashboard stats" });
  }
};
