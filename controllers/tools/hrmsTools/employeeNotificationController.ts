import { Request, Response } from "express";
import { fetchAllNotificationsService } from "../../../utilities/hrmsUtilities/dbCalls";

export const getCurrentEmployeeNotifications = async (req: Request, res: Response) => {
    const { empUuid } = req.params;

    if(!empUuid) {
        res.status(400).json({
            success: false,
            message: "Employee UUID is required",
        });
        return;
    }
    try{
        const notifications = await fetchAllNotificationsService(empUuid);
        if (
            !notifications ||
            (
                (!Array.isArray(notifications.myUpdates) || notifications.myUpdates.length === 0) &&
                (!Array.isArray(notifications.organizationUpdates) || notifications.organizationUpdates.length === 0)
            )
        ) {
            res.status(200).json({
                success: false,
                message: "No notifications found for this employee",
            });
            return;
        }

        res.status(200).json({
            success: true,
            message: "Notifications fetched successfully",
            notifications: notifications,
        });

    } catch(error) {
        console.error("Error fetching notifications:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
        return;
    }
}