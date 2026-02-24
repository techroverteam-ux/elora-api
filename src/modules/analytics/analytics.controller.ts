import { Request, Response } from "express";
import Store, { StoreStatus } from "../store/store.model";
import User from "../user/user.model";

// @desc    Get analytics dashboard data
// @route   GET /api/v1/analytics/dashboard
// @access  Private
export const getDashboardAnalytics = async (req: Request | any, res: Response) => {
  try {
    const userRoles = req.user?.roles || [];
    const isSuperAdmin = userRoles.some((r: any) => r?.code === "SUPER_ADMIN" || r?.name === "SUPER_ADMIN");
    const isAdmin = userRoles.some((r: any) => r?.code === "ADMIN" || r?.name === "ADMIN");
    const isRecceUser = userRoles.some((r: any) => r?.code === "RECCE" || r?.name === "RECCE");
    const isInstallationUser = userRoles.some((r: any) => r?.code === "INSTALLATION" || r?.name === "INSTALLATION");

    let analytics: any = {};

    if (isSuperAdmin || isAdmin) {
      // SUPER ADMIN / ADMIN ANALYTICS
      const totalStores = await Store.countDocuments();
      const uploadedStores = await Store.countDocuments({ currentStatus: StoreStatus.UPLOADED });
      const manuallyAdded = await Store.countDocuments({ currentStatus: StoreStatus.MANUALLY_ADDED });
      
      // Recce Analytics
      const recceAssigned = await Store.countDocuments({ currentStatus: StoreStatus.RECCE_ASSIGNED });
      const recceSubmitted = await Store.countDocuments({ currentStatus: StoreStatus.RECCE_SUBMITTED });
      const recceApproved = await Store.countDocuments({ currentStatus: StoreStatus.RECCE_APPROVED });
      const recceRejected = await Store.countDocuments({ currentStatus: StoreStatus.RECCE_REJECTED });
      
      // Installation Analytics
      const installationAssigned = await Store.countDocuments({ currentStatus: StoreStatus.INSTALLATION_ASSIGNED });
      const installationSubmitted = await Store.countDocuments({ currentStatus: StoreStatus.INSTALLATION_SUBMITTED });
      const completed = await Store.countDocuments({ currentStatus: StoreStatus.COMPLETED });
      
      // User Analytics
      const totalUsers = await User.countDocuments();
      const activeUsers = await User.countDocuments({ isActive: true });
      
      // Recent Activity (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const recentStores = await Store.countDocuments({ createdAt: { $gte: sevenDaysAgo } });
      const recentRecceSubmissions = await Store.countDocuments({ 
        "recce.submittedDate": { $gte: sevenDaysAgo } 
      });
      const recentInstallations = await Store.countDocuments({ 
        "installation.submittedDate": { $gte: sevenDaysAgo } 
      });
      
      // Top Performers
      const topRecceUsers = await Store.aggregate([
        { $match: { "workflow.recceAssignedTo": { $exists: true } } },
        { $group: { _id: "$workflow.recceAssignedTo", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
        { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
        { $unwind: "$user" },
        { $project: { name: "$user.name", count: 1 } }
      ]);
      
      const topInstallationUsers = await Store.aggregate([
        { $match: { "workflow.installationAssignedTo": { $exists: true } } },
        { $group: { _id: "$workflow.installationAssignedTo", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
        { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
        { $unwind: "$user" },
        { $project: { name: "$user.name", count: 1 } }
      ]);
      
      // City-wise Distribution
      const cityDistribution = await Store.aggregate([
        { $group: { _id: "$location.city", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]);
      
      // Status Distribution
      const statusDistribution = await Store.aggregate([
        { $group: { _id: "$currentStatus", count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);

      // Get detailed assignments for admin
      const assignments = await Store.aggregate([
        {
          $match: {
            $or: [
              { "workflow.recceAssignedTo": { $exists: true, $ne: null } },
              { "workflow.installationAssignedTo": { $exists: true, $ne: null } }
            ]
          }
        },
        {
          $lookup: {
            from: "users",
            localField: "workflow.recceAssignedTo",
            foreignField: "_id",
            as: "recceUser"
          }
        },
        {
          $lookup: {
            from: "users",
            localField: "workflow.installationAssignedTo",
            foreignField: "_id",
            as: "installUser"
          }
        },
        {
          $project: {
            storeId: "$_id",
            storeName: 1,
            dealerCode: 1,
            city: "$location.city",
            state: "$location.state",
            status: "$currentStatus",
            recceAssignment: {
              assignedTo: { $arrayElemAt: ["$recceUser.name", 0] },
              role: "RECCE",
              date: "$workflow.recceAssignedDate"
            },
            installAssignment: {
              assignedTo: { $arrayElemAt: ["$installUser.name", 0] },
              role: "INSTALLATION",
              date: "$workflow.installationAssignedDate"
            }
          }
        },
        { $sort: { "workflow.recceAssignedDate": -1, "workflow.installationAssignedDate": -1 } },
        { $limit: 100 }
      ]);

      // Flatten assignments
      const flatAssignments: any[] = [];
      assignments.forEach((a: any) => {
        if (a.recceAssignment.assignedTo) {
          flatAssignments.push({
            storeId: a.storeId,
            storeName: a.storeName,
            dealerCode: a.dealerCode,
            city: a.city,
            state: a.state,
            assignedTo: a.recceAssignment.assignedTo,
            role: a.recceAssignment.role,
            date: a.recceAssignment.date,
            status: a.status
          });
        }
        if (a.installAssignment.assignedTo) {
          flatAssignments.push({
            storeId: a.storeId,
            storeName: a.storeName,
            dealerCode: a.dealerCode,
            city: a.city,
            state: a.state,
            assignedTo: a.installAssignment.assignedTo,
            role: a.installAssignment.role,
            date: a.installAssignment.date,
            status: a.status
          });
        }
      });

      analytics = {
        overview: {
          totalStores,
          uploadedStores,
          manuallyAdded,
          totalUsers,
          activeUsers
        },
        recce: {
          assigned: recceAssigned,
          submitted: recceSubmitted,
          approved: recceApproved,
          rejected: recceRejected,
          total: recceAssigned + recceSubmitted + recceApproved + recceRejected,
          completionRate: recceApproved > 0 ? ((recceApproved / (recceApproved + recceRejected)) * 100).toFixed(2) : 0
        },
        installation: {
          assigned: installationAssigned,
          submitted: installationSubmitted,
          completed,
          total: installationAssigned + installationSubmitted + completed,
          completionRate: completed > 0 ? ((completed / (installationAssigned + installationSubmitted + completed)) * 100).toFixed(2) : 0
        },
        recentActivity: {
          newStores: recentStores,
          recceSubmissions: recentRecceSubmissions,
          installations: recentInstallations
        },
        topPerformers: {
          recce: topRecceUsers,
          installation: topInstallationUsers
        },
        distribution: {
          byCity: cityDistribution,
          byStatus: statusDistribution
        },
        assignments: flatAssignments
      };
    } else if (isRecceUser) {
      // RECCE USER ANALYTICS
      const assignedToMe = await Store.countDocuments({ 
        "workflow.recceAssignedTo": req.user?._id 
      });
      const pending = await Store.countDocuments({ 
        "workflow.recceAssignedTo": req.user?._id,
        currentStatus: StoreStatus.RECCE_ASSIGNED 
      });
      const submitted = await Store.countDocuments({ 
        "workflow.recceAssignedTo": req.user?._id,
        currentStatus: StoreStatus.RECCE_SUBMITTED 
      });
      const approved = await Store.countDocuments({ 
        "workflow.recceAssignedTo": req.user?._id,
        currentStatus: StoreStatus.RECCE_APPROVED 
      });
      const rejected = await Store.countDocuments({ 
        "workflow.recceAssignedTo": req.user?._id,
        currentStatus: StoreStatus.RECCE_REJECTED 
      });
      
      // Recent submissions (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const recentSubmissions = await Store.countDocuments({ 
        "workflow.recceAssignedTo": req.user?._id,
        "recce.submittedDate": { $gte: sevenDaysAgo } 
      });
      
      // City-wise tasks
      const cityTasks = await Store.aggregate([
        { $match: { "workflow.recceAssignedTo": req.user?._id } },
        { $group: { _id: "$location.city", count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);

      // Get my tasks
      const myTasks = await Store.find({ "workflow.recceAssignedTo": req.user?._id })
        .sort({ "recce.assignedDate": -1, createdAt: -1 })
        .limit(20)
        .select("storeName dealerCode location.city location.state location.district currentStatus recce.assignedDate createdAt");

      analytics = {
        overview: {
          totalAssigned: assignedToMe,
          pending,
          submitted,
          approved,
          rejected,
          completionRate: approved > 0 ? ((approved / assignedToMe) * 100).toFixed(2) : 0
        },
        recentActivity: {
          submissionsLast7Days: recentSubmissions
        },
        distribution: {
          byCity: cityTasks
        },
        myTasks: myTasks.map((t: any) => ({
          storeName: t.storeName,
          city: t.location?.city,
          state: t.location?.state,
          district: t.location?.district,
          status: t.currentStatus,
          assignedDate: t.recce?.assignedDate || t.createdAt
        }))
      };
    } else if (isInstallationUser) {
      // INSTALLATION USER ANALYTICS
      const assignedToMe = await Store.countDocuments({ 
        "workflow.installationAssignedTo": req.user?._id 
      });
      const pending = await Store.countDocuments({ 
        "workflow.installationAssignedTo": req.user?._id,
        currentStatus: StoreStatus.INSTALLATION_ASSIGNED 
      });
      const submitted = await Store.countDocuments({ 
        "workflow.installationAssignedTo": req.user?._id,
        currentStatus: StoreStatus.INSTALLATION_SUBMITTED 
      });
      const completed = await Store.countDocuments({ 
        "workflow.installationAssignedTo": req.user?._id,
        currentStatus: StoreStatus.COMPLETED 
      });
      
      // Recent submissions (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const recentSubmissions = await Store.countDocuments({ 
        "workflow.installationAssignedTo": req.user?._id,
        "installation.submittedDate": { $gte: sevenDaysAgo } 
      });
      
      // City-wise tasks
      const cityTasks = await Store.aggregate([
        { $match: { "workflow.installationAssignedTo": req.user?._id } },
        { $group: { _id: "$location.city", count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);

      // Get my tasks
      const myTasks = await Store.find({ "workflow.installationAssignedTo": req.user?._id })
        .sort({ "installation.assignedDate": -1, createdAt: -1 })
        .limit(20)
        .select("storeName dealerCode location.city location.state location.district currentStatus installation.assignedDate createdAt");

      analytics = {
        overview: {
          totalAssigned: assignedToMe,
          pending,
          submitted,
          completed,
          completionRate: completed > 0 ? ((completed / assignedToMe) * 100).toFixed(2) : 0
        },
        recentActivity: {
          submissionsLast7Days: recentSubmissions
        },
        distribution: {
          byCity: cityTasks
        },
        myTasks: myTasks.map((t: any) => ({
          storeName: t.storeName,
          city: t.location?.city,
          state: t.location?.state,
          district: t.location?.district,
          status: t.currentStatus,
          assignedDate: t.installation?.assignedDate || t.createdAt
        }))
      };
    }

    // If no specific role matched, return empty analytics with a message
    if (Object.keys(analytics).length === 0) {
      analytics = {
        overview: {
          totalAssigned: 0,
          pending: 0,
          submitted: 0,
          approved: 0,
          completed: 0,
          completionRate: 0
        },
        recentActivity: {
          submissionsLast7Days: 0
        },
        distribution: {
          byCity: []
        },
        myTasks: [],
        message: "No role assigned or insufficient permissions"
      };
    }

    res.status(200).json({ analytics });
  } catch (error: any) {
    console.error("Analytics Error:", error);
    res.status(500).json({ message: "Failed to fetch analytics", error: error.message });
  }
};
