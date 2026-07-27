import express from 'express';
import { 
    getCurrentEmployeeNotifications 
} from "../../../controllers/tools/hrmsTools/employeeNotificationController";
import { isTmsUserAuthenticated } from "../../../middlewares/isAuthenticated";
import {tenantMiddleware} from '../../../middlewares/tenantMiddleware';

const router = express.Router();

router.route("/:empUuid/currentEmployeeNotifications").get( isTmsUserAuthenticated,tenantMiddleware, getCurrentEmployeeNotifications );

export default router;
