const express = require("express");
const {getAllComponentType} = require('../../../controllers/tools/hrmsTools/employeeComponentConfiguratorController');
const router = express.Router();
const { isTmsUserAuthenticated } = require("../../../middlewares/isAuthenticated");

router.route("/getAllComponentType").get(isTmsUserAuthenticated, getAllComponentType);

module.exports= router;