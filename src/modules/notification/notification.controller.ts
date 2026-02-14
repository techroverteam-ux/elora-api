import { Request, Response } from "express";
import Store from "../store/store.model";
import Enquiry from "../enquiry/enquiry.model";
import { StoreStatus } from "../store/store.model";

export const getNotifications = async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const notifications: any[] = [];

    const isSuperAdmin = user.roles.some((r: any) => r.code === "SUPER_ADMIN");
    const isAdmin = user.roles.some((r: any) => r.code === "ADMIN" || r.code === "SUPER_ADMIN");
    const isRecceUser = user.roles.some((r: any) => r.name === "RECCE");
    const isInstallUser = user.roles.some((r: any) => r.name === "INSTALLATION");

    if (isAdmin) {
      const newEnquiries = await Enquiry.countDocuments({ status: "NEW" });
      if (newEnquiries > 0) {
        notifications.push({
          id: "new-enquiries",
          type: "ENQUIRY",
          title: "New Enquiries",
          message: `${newEnquiries} new enquir${newEnquiries > 1 ? "ies" : "y"} received`,
          count: newEnquiries,
          link: "/enquiries",
          timestamp: new Date(),
        });
      }

      const recceSubmitted = await Store.countDocuments({ currentStatus: StoreStatus.RECCE_SUBMITTED });
      if (recceSubmitted > 0) {
        notifications.push({
          id: "recce-submitted",
          type: "RECCE",
          title: "Recce Pending Approval",
          message: `${recceSubmitted} recce report${recceSubmitted > 1 ? "s" : ""} awaiting approval`,
          count: recceSubmitted,
          link: "/stores",
          timestamp: new Date(),
        });
      }

      const installCompleted = await Store.countDocuments({ currentStatus: StoreStatus.INSTALLATION_SUBMITTED });
      if (installCompleted > 0) {
        notifications.push({
          id: "install-completed",
          type: "INSTALLATION",
          title: "Installation Completed",
          message: `${installCompleted} installation${installCompleted > 1 ? "s" : ""} completed`,
          count: installCompleted,
          link: "/installation",
          timestamp: new Date(),
        });
      }

      const storesUploaded = await Store.countDocuments({ currentStatus: StoreStatus.UPLOADED });
      if (storesUploaded > 0) {
        notifications.push({
          id: "stores-uploaded",
          type: "STORE",
          title: "Stores Need Assignment",
          message: `${storesUploaded} store${storesUploaded > 1 ? "s" : ""} waiting for recce assignment`,
          count: storesUploaded,
          link: "/stores",
          timestamp: new Date(),
        });
      }
    }

    if (isRecceUser) {
      const assignedRecce = await Store.find({
        currentStatus: StoreStatus.RECCE_ASSIGNED,
        "workflow.recceAssignedTo": user._id,
      }).limit(5);

      assignedRecce.forEach((store) => {
        notifications.push({
          id: `recce-${store._id}`,
          type: "RECCE_ASSIGNED",
          title: "New Recce Assignment",
          message: `Recce assigned for ${store.storeName}`,
          link: `/recce/${store._id}`,
          timestamp: new Date(),
        });
      });
    }

    if (isInstallUser) {
      const assignedInstall = await Store.find({
        currentStatus: StoreStatus.INSTALLATION_ASSIGNED,
        "workflow.installationAssignedTo": user._id,
      }).limit(5);

      assignedInstall.forEach((store) => {
        notifications.push({
          id: `install-${store._id}`,
          type: "INSTALLATION_ASSIGNED",
          title: "New Installation Assignment",
          message: `Installation assigned for ${store.storeName}`,
          link: `/installation/${store._id}`,
          timestamp: new Date(),
        });
      });
    }

    notifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.status(200).json({ notifications });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to fetch notifications", error: error.message });
  }
};
