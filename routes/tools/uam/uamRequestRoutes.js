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
const { isAuthenticated } = require("../../../middlewares/isAuthenticated");

//this file will contains all the controllers from assetTypes controller and will be available only for admin in future.

router.route("/add").post(isAuthenticated, createRequest);
router.route("/getall").get(isAuthenticated, getAllRequests);
router.route("/get/:id").get(isAuthenticated, getRequestById);
router.route("/get/userId/:id").get(isAuthenticated, getRequestByUserId);
router.route("/update/:id").patch(isAuthenticated, changRequestStatus);

router.route("/getall/logs").get(isAuthenticated, getAllActivityLogs);

module.exports = router;
