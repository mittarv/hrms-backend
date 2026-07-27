const express = require("express");
const {getAllComponentType, updateComponentType} = require('../../../controllers/tools/hrmsTools/employeeComponentConfiguratorController');
const router = express.Router();
const { isTmsUserAuthenticated } = require("../../../middlewares/isAuthenticated");
const { tenantMiddleware } = require("../../../middlewares/tenantMiddleware");

router.route("/getAllComponentType").get( isTmsUserAuthenticated,tenantMiddleware, getAllComponentType);
router.route("/updateComponentType").put(isTmsUserAuthenticated,tenantMiddleware, updateComponentType);

module.exports= router;