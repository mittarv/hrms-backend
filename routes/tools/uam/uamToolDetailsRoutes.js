const express = require('express');
const { createTool, getAllToolDetails, deleteToolById, updateUamTools , getAllToolAdmintools} = require('../../../controllers/tools/uam/uamToolDetailsController');
const router = express.Router();
const { isTmsUserAuthenticated } = require("../../../middlewares/isAuthenticated")

//this file will contains all the controllers from assetTypes controller and will be available only for admin in future.

router.route('/add').post(createTool)
router.route('/getall/').get(getAllToolDetails)
router.route('/getall/:tid').get(getAllToolAdmintools)
router.route('/update').patch(isTmsUserAuthenticated, updateUamTools)
router.route('/delete').patch(isTmsUserAuthenticated, deleteToolById)

module.exports = router;