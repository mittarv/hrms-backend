const express = require("express");
const router = express.Router();
const {
  getImportantLinkList,
  getPolicyList,
  updateImportantLink,
  updatePolicy,
  addImportantLink,
  addPolicy,
  deleteImportantLink,
  deletePolicy,
} = require("../../../controllers/tools/hrRepository/importantLinkAndPolicyController");
const { isTmsUserAuthenticated } =require( "../../../middlewares/isAuthenticated");

// =====================================important link related routes===================================================================

router
  .route("/getall/importantlink")
  .get(isTmsUserAuthenticated, getImportantLinkList);
router
  .route("/add/importantlink")
  .post(isTmsUserAuthenticated, addImportantLink);
router
  .route("/update/importantlink")
  .patch(isTmsUserAuthenticated, updateImportantLink);
router
  .route("/delete/importantlink")
  .patch(isTmsUserAuthenticated, deleteImportantLink);

// =====================================policy related routes===================================================================
router.route("/getall/policy").get(isTmsUserAuthenticated, getPolicyList);
router.route("/add/policy").post(isTmsUserAuthenticated, addPolicy);
router.route("/update/policy").patch(isTmsUserAuthenticated, updatePolicy);
router.route("/delete/policy").patch(isTmsUserAuthenticated, deletePolicy);

module.exports= router;
