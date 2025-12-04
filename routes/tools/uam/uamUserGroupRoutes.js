const express = require('express');
const { createNewUserGroup, getAllUserGroups, updateUserGroupById, deleteUserGroupsByIds } = require('../../../controllers/tools/uam/uamUserGroupsController');
const router = express.Router();
const { isTmsUserAuthenticated } = require("../../../middlewares/isAuthenticated")

//this file will contains all the controllers from assetTypes controller and will be available only for admin in future.

router.route('/add').post(isTmsUserAuthenticated, createNewUserGroup)
router.route('/getall/').get(getAllUserGroups)
// router.route('/get/:id').get(isAuthenticated, getUserDetailsById)
router.route('/update').patch(isTmsUserAuthenticated, updateUserGroupById)
//now updating the isDeleted column to true, so that we can delete the data
router.route('/delete').patch(isTmsUserAuthenticated, deleteUserGroupsByIds)

module.exports = router;