import express from "express";
import { isTmsUserAuthenticated } from "../../../middlewares/isAuthenticated";
import {
  createSecondaryLocationConfig,
  getSecondaryLocationConfigs,
  updateSecondaryLocationConfig,
  deleteSecondaryLocationConfig,
  getSecondaryLocationOverview,
  createSecondaryLocationLog,
  getSecondaryLocationLogs,
  updateSecondaryLocationLog,
  deleteSecondaryLocationLog,
  getSecondaryLocationRequests,
  reviewSecondaryLocationRequest,
} from "../../../controllers/tools/hrmsTools/secondaryLocationController";
import {tenantMiddleware} from "../../../middlewares/tenantMiddleware";

const router = express.Router();

router.route("/CreateConfig").post(isTmsUserAuthenticated,tenantMiddleware, createSecondaryLocationConfig);
router.route("/getConfig").get(isTmsUserAuthenticated,tenantMiddleware, getSecondaryLocationConfigs);
router.route("/updateConfig/:configId").patch(isTmsUserAuthenticated,tenantMiddleware, updateSecondaryLocationConfig);
router.route("/deleteConfig/:configId").delete(isTmsUserAuthenticated,tenantMiddleware, deleteSecondaryLocationConfig);

router.route("/getOverview").get(isTmsUserAuthenticated,tenantMiddleware, getSecondaryLocationOverview);
router.route("/CreateLog").post(isTmsUserAuthenticated,tenantMiddleware, createSecondaryLocationLog);
router.route("/getLogs").get(isTmsUserAuthenticated,tenantMiddleware, getSecondaryLocationLogs);
router.route("/updateLog/:logId").patch(isTmsUserAuthenticated,tenantMiddleware, updateSecondaryLocationLog);
router.route("/deleteLog/:logId").delete(isTmsUserAuthenticated,tenantMiddleware, deleteSecondaryLocationLog);

router.route("/getRequests").get(isTmsUserAuthenticated,tenantMiddleware, getSecondaryLocationRequests);
router.route("/reviewRequest/:requestId").post(isTmsUserAuthenticated,tenantMiddleware, reviewSecondaryLocationRequest);

export default router;
