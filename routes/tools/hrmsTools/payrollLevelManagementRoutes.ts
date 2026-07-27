import express from "express";
import { isTmsUserAuthenticated } from "../../../middlewares/isAuthenticated";
import {
  createPayrollLevel,
  getPayrollLevels,
  updatePayrollLevel,
} from "../../../controllers/tools/hrmsTools/payrollLevelManagementController";
import {tenantMiddleware} from "../../../middlewares/tenantMiddleware";

const router = express.Router();

router.route("/getPayrollLevels").get(isTmsUserAuthenticated,tenantMiddleware, getPayrollLevels);
router.route("/createPayrollLevel").post(isTmsUserAuthenticated,tenantMiddleware, createPayrollLevel);
router.route("/updatePayrollLevel").patch(isTmsUserAuthenticated,tenantMiddleware, updatePayrollLevel);

export default router;
