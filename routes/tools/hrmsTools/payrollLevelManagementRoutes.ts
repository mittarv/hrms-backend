import express from "express";
import { isTmsUserAuthenticated } from "../../../middlewares/isAuthenticated";
import {
  createPayrollLevel,
  getPayrollLevels,
  updatePayrollLevel,
} from "../../../controllers/tools/hrmsTools/payrollLevelManagementController";

const router = express.Router();

router.route("/getPayrollLevels").get(isTmsUserAuthenticated, getPayrollLevels);
router.route("/createPayrollLevel").post(isTmsUserAuthenticated, createPayrollLevel);
router.route("/updatePayrollLevel").patch(isTmsUserAuthenticated, updatePayrollLevel);

export default router;
