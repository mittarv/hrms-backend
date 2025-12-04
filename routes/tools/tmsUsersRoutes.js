const express = require("express");
const {
  createTmsUser,
  getUserDetailsById,
  getAllUserDetails,
  updateUserDetailsById,
  removeUserById,
  tmsUserGoogleLogin,
  createTmsUserWithoutLogin,
} = require("../../controllers/tools/tmsUsersController");
const router = express.Router();
const { isTmsUserAuthenticated } = require("../../middlewares/isAuthenticated");

//this file will contains all the controllers from assetTypes controller and will be available only for admin in future.

router.route("/login").post(tmsUserGoogleLogin);
router.route("/add").post(createTmsUser);
router.route("/getall/").get(isTmsUserAuthenticated, getAllUserDetails);
router.route("/get").get(isTmsUserAuthenticated, getUserDetailsById);
router.route("/update/:id").patch(isTmsUserAuthenticated, updateUserDetailsById);
router.route("/delete/:id").delete(isTmsUserAuthenticated, removeUserById);          
router.route("/createUser").post(isTmsUserAuthenticated, createTmsUserWithoutLogin);  

module.exports = router;
