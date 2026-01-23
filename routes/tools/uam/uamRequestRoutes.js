const express = require("express");
const {
  createRequest,
  getAllRequests,
  getRequestById,
  changRequestStatus,
  getRequestByUserId,
  getAllActivityLogs,
} = require("../../../controllers/tools/uam/uamRequestController");
const router = express.Router();
const { isTmsUserAuthenticated } = require("../../../middlewares/isAuthenticated");

//this file will contains all the controllers from assetTypes controller and will be available only for admin in future.

router.route("/add").post(isTmsUserAuthenticated, createRequest);
router.route("/getall").get(isTmsUserAuthenticated, getAllRequests);
router.route("/get/:id").get(isTmsUserAuthenticated, getRequestById);
router.route("/get/userId/:id").get(isTmsUserAuthenticated, getRequestByUserId);
router.route("/update/:id").patch(isTmsUserAuthenticated, changRequestStatus);

router.route("/getall/logs").get(isTmsUserAuthenticated, getAllActivityLogs);

module.exports = router;
