const express = require("express");

const {createLeave,updateLeaveConfiguration,getAllLeaves, getLeaveDetailsByUuid} = require("../../../controllers/tools/hrmsTools/employeeLeaveConfiguratorController");
const router = express.Router();
const {isTmsUserAuthenticated} = require("../../../middlewares/isAuthenticated");

router.route("/createLeave").post(isTmsUserAuthenticated,createLeave);
router.route("/updateLeaveConfiguration").patch(isTmsUserAuthenticated,updateLeaveConfiguration);
router.route("/getAllLeaves").get(isTmsUserAuthenticated,getAllLeaves);
router.route("/getLeaveDetailsByUuid/:id").get(isTmsUserAuthenticated,getLeaveDetailsByUuid);

module.exports = router;