const express = require("express");
const {getAllComponentType, updateComponentType} = require('../../../controllers/tools/hrmsTools/employeeComponentConfiguratorController');
const router = express.Router();
const { isTmsUserAuthenticated } = require("../../../middlewares/isAuthenticated");

router.route("/getAllComponentType").get( getAllComponentType);
router.route("/updateComponentType").put(isTmsUserAuthenticated, updateComponentType);

module.exports= router;