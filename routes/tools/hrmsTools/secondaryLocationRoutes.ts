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

const router = express.Router();

router.route("/CreateConfig").post(isTmsUserAuthenticated, createSecondaryLocationConfig);
router.route("/getConfig").get(isTmsUserAuthenticated, getSecondaryLocationConfigs);
router.route("/updateConfig/:configId").patch(isTmsUserAuthenticated, updateSecondaryLocationConfig);
router.route("/deleteConfig/:configId").delete(isTmsUserAuthenticated, deleteSecondaryLocationConfig);

router.route("/getOverview").get(isTmsUserAuthenticated, getSecondaryLocationOverview);
router.route("/CreateLog").post(isTmsUserAuthenticated, createSecondaryLocationLog);
router.route("/getLogs").get(isTmsUserAuthenticated, getSecondaryLocationLogs);
router.route("/updateLog/:logId").patch(isTmsUserAuthenticated, updateSecondaryLocationLog);
router.route("/deleteLog/:logId").delete(isTmsUserAuthenticated, deleteSecondaryLocationLog);

router.route("/getRequests").get(isTmsUserAuthenticated, getSecondaryLocationRequests);
router.route("/reviewRequest/:requestId").post(isTmsUserAuthenticated, reviewSecondaryLocationRequest);

export default router;
