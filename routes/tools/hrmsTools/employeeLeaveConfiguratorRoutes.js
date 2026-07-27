const express = require("express");

const {createLeave,updateLeaveConfiguration,getAllLeaves, getLeaveDetailsByUuid} = require("../../../controllers/tools/hrmsTools/employeeLeaveConfiguratorController");
const router = express.Router();
const {isTmsUserAuthenticated} = require("../../../middlewares/isAuthenticated");
const { tenantMiddleware } = require("../../../middlewares/tenantMiddleware");

router.route("/createLeave").post(isTmsUserAuthenticated,tenantMiddleware,createLeave);
router.route("/updateLeaveConfiguration").patch(isTmsUserAuthenticated,tenantMiddleware,updateLeaveConfiguration);
router.route("/getAllLeaves").get(isTmsUserAuthenticated,tenantMiddleware,getAllLeaves);
router.route("/getLeaveDetailsByUuid/:id").get(isTmsUserAuthenticated,tenantMiddleware,getLeaveDetailsByUuid);

module.exports = router;