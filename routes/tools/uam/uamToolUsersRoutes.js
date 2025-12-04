const express = require('express');
const { addUserToTool, getAllToolUsersByToolId, getAllToolDetailsByUserId, removeUserFromToolbyToolId, getAllToolUsersWithTools,updateToolUserGroup } = require('../../../controllers/tools/uam/uamToolUsersController');
const router = express.Router();
const { isTmsUserAuthenticated } = require("../../../middlewares/isAuthenticated")

//this file will contains all the controllers from assetTypes controller and will be available only for admin in future.

router.route('/add').post(isTmsUserAuthenticated, addUserToTool)
router.route('/getall/tools').get(getAllToolUsersWithTools)
router.route('/getall/:id').get(isTmsUserAuthenticated, getAllToolUsersByToolId)
router.route('/get/:id').get(isTmsUserAuthenticated, getAllToolDetailsByUserId)
router.route('/update').patch(isTmsUserAuthenticated, updateToolUserGroup)
router.route('/delete/').post(isTmsUserAuthenticated, removeUserFromToolbyToolId)

module.exports = router;