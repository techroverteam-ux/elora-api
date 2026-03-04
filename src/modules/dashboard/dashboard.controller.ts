import { Request, Response } from "express";
import Store, { StoreStatus } from "../store/store.model";
import User from "../user/user.model";

const parseDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  // Handle DD-MMM-YYYY format (e.g., "01-Jan-2024")
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const day = parseInt(parts[0]);
    const monthMap: any = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
    const month = monthMap[parts[1]];
    const year = parseInt(parts[2]);
    if (!isNaN(day) && month !== undefined && !isNaN(year)) {
      return new Date(year, month, day);
    }
  }
  // Fallback to standard Date parsing
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
};

export const getDashboardStats = async (req: Request | any, res: Response) => {
  try {
    const { startDate, endDate, status, zone, state, store, client, city, district } = req.query;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Build filter
    const filter: any = {};
    
    // Role-based Access Control
    const userRoles = req.user?.roles || [];
    const isSuperAdmin = userRoles.some((r: any) => r?.code === "SUPER_ADMIN" || r?.name === "SUPER_ADMIN");
    const isAdmin = userRoles.some((r: any) => r?.code === "ADMIN" || r?.name === "ADMIN");
    const isRecceUser = userRoles.some((r: any) => r?.code === "RECCE" || r?.name === "RECCE");
    const isInstallationUser = userRoles.some((r: any) => r?.code === "INSTALLATION" || r?.name === "INSTALLATION");

    if (!isSuperAdmin && !isAdmin && req.user?._id) {
      filter.$or = [
        { "workflow.recceAssignedTo": req.user._id },
        { "workflow.installationAssignedTo": req.user._id },
      ];
    }
    
    if (startDate && endDate) {
      const start = parseDate(startDate as string);
      const end = parseDate(endDate as string);
      if (start && end) {
        end.setHours(23, 59, 59, 999);
        filter.createdAt = { $gte: start, $lte: end };
      }
    }
    if (status) filter.currentStatus = status;
    if (zone) filter['location.zone'] = new RegExp(zone as string, 'i');
    if (state) filter['location.state'] = new RegExp(state as string, 'i');
    if (city) filter['location.city'] = new RegExp(city as string, 'i');
    if (district) filter['location.district'] = new RegExp(district as string, 'i');
    if (store) filter.$or = [{ storeName: new RegExp(store as string, 'i') }, { storeCode: new RegExp(store as string, 'i') }];
    if (client) filter.$or = [{ clientCode: new RegExp(client as string, 'i') }];

    // KPI COUNTS
    const totalStores = await Store.countDocuments(filter);
    const newStoresToday = await Store.countDocuments({ ...filter, createdAt: { $gte: today } });
    
    const recceDoneTotal = await Store.countDocuments({
      ...filter,
      currentStatus: { $in: [StoreStatus.RECCE_SUBMITTED, StoreStatus.RECCE_APPROVED, StoreStatus.INSTALLATION_ASSIGNED, StoreStatus.INSTALLATION_SUBMITTED, StoreStatus.COMPLETED] }
    });
    const recceDoneToday = await Store.countDocuments({ ...filter, "recce.submittedDate": { $gte: today } });

    // Recce Assigned (pending recce) - stores currently assigned for recce
    const recceAssigned = await Store.countDocuments({
      ...filter,
      currentStatus: StoreStatus.RECCE_ASSIGNED
    });

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
      { $match: { ...filter, createdAt: { $gte: sixMonthsAgo } } },
      { $group: {
        _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
        count: { $sum: 1 }
      }},
      { $sort: { _id: 1 } }
    ]);

    // Personnel stats (only for admin)
    let personnelStats: Array<{
      _id: any;
      name: string;
      email: string;
      role: string;
      assignedCount: number;
      completedCount: number;
    }> = [];
    if (isSuperAdmin || isAdmin) {
      try {
        const recceUsers = await User.find({ isActive: true }).populate({
          path: 'roles',
          match: { code: { $in: ['RECCE', 'INSTALLATION'] } }
        }).lean();

        const validUsers = recceUsers.filter(u => u.roles && (u.roles as any[]).length > 0);

        personnelStats = await Promise.all(validUsers.map(async (user: any) => {
          const role = user.roles[0];
          const assignedStores = await Store.find({
            $or: [
              { 'workflow.recceAssignedTo': user._id },
              { 'workflow.installationAssignedTo': user._id }
            ]
          }).lean();

          const completedStores = assignedStores.filter((store: any) => {
            if (store.workflow?.recceAssignedTo?.toString() === user._id.toString()) {
              return ['RECCE_SUBMITTED', 'RECCE_APPROVED', 'INSTALLATION_ASSIGNED', 'INSTALLATION_SUBMITTED', 'COMPLETED'].includes(store.currentStatus);
            }
            if (store.workflow?.installationAssignedTo?.toString() === user._id.toString()) {
              return ['INSTALLATION_SUBMITTED', 'COMPLETED'].includes(store.currentStatus);
            }
            return false;
          });

          return {
            _id: user._id,
            name: user.name,
            email: user.email,
            role: role.code,
            assignedCount: assignedStores.length,
            completedCount: completedStores.length
          };
        }));
      } catch (err) {
        console.error('Personnel stats error:', err);
      }
    }

    // Recent stores
    const recentStores = await Store.find(filter)
      .sort({ createdAt: -1 })
      .limit(5)
      .select("storeName dealerCode location.city currentStatus createdAt");

    res.json({
      kpi: {
        totalStores,
        newStoresToday,
        recceAssigned,
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
      isAdmin: isSuperAdmin || isAdmin,
      isRecceUser,
      isInstallationUser
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch dashboard stats" });
  }
};
