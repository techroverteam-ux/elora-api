import { Request, Response } from "express";
import Store, { StoreStatus } from "../store/store.model";
import User from "../user/user.model";

// @desc    Get analytics dashboard data
// @route   GET /api/v1/analytics/dashboard
// @access  Private
export const getDashboardAnalytics = async (req: Request | any, res: Response) => {
  try {
    const userRoles = req.user.roles || [];
    const isSuperAdmin = userRoles.some((r: any) => r.code === "SUPER_ADMIN");
    const isAdmin = userRoles.some((r: any) => r.code === "ADMIN");
    const isRecceUser = userRoles.some((r: any) => r.code === "RECCE");
    const isInstallationUser = userRoles.some((r: any) => r.code === "INSTALLATION");

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
        }
      };
    } else if (isRecceUser) {
      // RECCE USER ANALYTICS
      const assignedToMe = await Store.countDocuments({ 
        "workflow.recceAssignedTo": req.user._id 
      });
      const pending = await Store.countDocuments({ 
        "workflow.recceAssignedTo": req.user._id,
        currentStatus: StoreStatus.RECCE_ASSIGNED 
      });
      const submitted = await Store.countDocuments({ 
        "workflow.recceAssignedTo": req.user._id,
        currentStatus: StoreStatus.RECCE_SUBMITTED 
      });
      const approved = await Store.countDocuments({ 
        "workflow.recceAssignedTo": req.user._id,
        currentStatus: StoreStatus.RECCE_APPROVED 
      });
      const rejected = await Store.countDocuments({ 
        "workflow.recceAssignedTo": req.user._id,
        currentStatus: StoreStatus.RECCE_REJECTED 
      });
      
      // Recent submissions (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const recentSubmissions = await Store.countDocuments({ 
        "workflow.recceAssignedTo": req.user._id,
        "recce.submittedDate": { $gte: sevenDaysAgo } 
      });
      
      // City-wise tasks
      const cityTasks = await Store.aggregate([
        { $match: { "workflow.recceAssignedTo": req.user._id } },
        { $group: { _id: "$location.city", count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);

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
        }
      };
    } else if (isInstallationUser) {
      // INSTALLATION USER ANALYTICS
      const assignedToMe = await Store.countDocuments({ 
        "workflow.installationAssignedTo": req.user._id 
      });
      const pending = await Store.countDocuments({ 
        "workflow.installationAssignedTo": req.user._id,
        currentStatus: StoreStatus.INSTALLATION_ASSIGNED 
      });
      const submitted = await Store.countDocuments({ 
        "workflow.installationAssignedTo": req.user._id,
        currentStatus: StoreStatus.INSTALLATION_SUBMITTED 
      });
      const completed = await Store.countDocuments({ 
        "workflow.installationAssignedTo": req.user._id,
        currentStatus: StoreStatus.COMPLETED 
      });
      
      // Recent submissions (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const recentSubmissions = await Store.countDocuments({ 
        "workflow.installationAssignedTo": req.user._id,
        "installation.submittedDate": { $gte: sevenDaysAgo } 
      });
      
      // City-wise tasks
      const cityTasks = await Store.aggregate([
        { $match: { "workflow.installationAssignedTo": req.user._id } },
        { $group: { _id: "$location.city", count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);

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
        }
      };
    }

    res.status(200).json({ analytics });
  } catch (error: any) {
    console.error("Analytics Error:", error);
    res.status(500).json({ message: "Failed to fetch analytics", error: error.message });
  }
};
