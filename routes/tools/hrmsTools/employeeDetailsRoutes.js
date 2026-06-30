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
} = require("../../../controllers/tools/hrmsTools/employeeDetailsController");
const router = express.Router();
const {
  isTmsUserAuthenticated,
} = require("../../../middlewares/isAuthenticated");

router.route("/createEmployeeData").post(isTmsUserAuthenticated, createEmployeeData);
router.route("/getAllEmployees").get(isTmsUserAuthenticated, getAllEmployees);
router.route("/getCurrentEmpDetails/:empUuid").get(isTmsUserAuthenticated, getEmployeeDetailsByUuid);
router.route("/getEmployeeDirectoryDetails/:empUuid").get(isTmsUserAuthenticated, getEmployeeDirectoryDetailsByUuid);
router.route("/updateCurrentEmpDetails/:empUuid").patch(isTmsUserAuthenticated, updateEmployeeDetailsByUuid);
router.route("/getAllManager").get(isTmsUserAuthenticated, getAllManagerInformation);
router.route("/getEmployeeDashboardDetails").get(isTmsUserAuthenticated, getEmployeeDashboardDetails);
router.route("/sendChangesToApprover").post(isTmsUserAuthenticated,sendChangesToApprover);
router.route("/approveOrRejectRequest").post(isTmsUserAuthenticated,approveOrRejectRequest);
router.route("/getPendingRequests").get(isTmsUserAuthenticated,getPendingRequests);

module.exports = router;
