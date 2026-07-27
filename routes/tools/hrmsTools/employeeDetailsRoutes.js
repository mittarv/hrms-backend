const express = require("express");

const {
  createEmployeeData,
  getEmployeeDetailsByUuid,
  getEmployeeDirectoryDetailsByUuid,
  getAllEmployees,
  updateEmployeeDetailsByUuid,
  getAllManagerInformation,
  getEmployeeDashboardDetails,
  sendChangesToApprover,
  approveOrRejectRequest,
  getPendingRequests,
  getProcessedRequests,
} = require("../../../controllers/tools/hrmsTools/employeeDetailsController");
const router = express.Router();
const {
  isTmsUserAuthenticated,
} = require("../../../middlewares/isAuthenticated");
const { tenantMiddleware } = require("../../../middlewares/tenantMiddleware");

router.route("/createEmployeeData").post(isTmsUserAuthenticated, tenantMiddleware, createEmployeeData);
router.route("/getAllEmployees").get(isTmsUserAuthenticated, tenantMiddleware, getAllEmployees);
router.route("/getCurrentEmpDetails/:empUuid").get(isTmsUserAuthenticated, tenantMiddleware, getEmployeeDetailsByUuid);
router.route("/getEmployeeDirectoryDetails/:empUuid").get(isTmsUserAuthenticated, tenantMiddleware, getEmployeeDirectoryDetailsByUuid);
router.route("/updateCurrentEmpDetails/:empUuid").patch(isTmsUserAuthenticated, tenantMiddleware, updateEmployeeDetailsByUuid);
router.route("/getAllManager").get(isTmsUserAuthenticated, tenantMiddleware, getAllManagerInformation);
router.route("/getEmployeeDashboardDetails").get(isTmsUserAuthenticated, tenantMiddleware, getEmployeeDashboardDetails);
router.route("/sendChangesToApprover").post(isTmsUserAuthenticated,tenantMiddleware,sendChangesToApprover);
router.route("/approveOrRejectRequest").post(isTmsUserAuthenticated,tenantMiddleware,approveOrRejectRequest);
router.route("/getPendingRequests").get(isTmsUserAuthenticated,tenantMiddleware,getPendingRequests);
router.route("/getProcessedRequests").get(isTmsUserAuthenticated,tenantMiddleware,getProcessedRequests);

module.exports = router;
