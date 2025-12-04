import express from 'express';
import { 
    getCurrentEmployeeNotifications 
} from "../../../controllers/tools/hrmsTools/employeeNotificationController";
import { isTmsUserAuthenticated } from "../../../middlewares/isAuthenticated";

const router = express.Router();

router.route("/:empUuid/currentEmployeeNotifications").get( isTmsUserAuthenticated, getCurrentEmployeeNotifications );

export default router;
