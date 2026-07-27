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
const { tenantMiddleware }=require("../../../middlewares/tenantMiddleware");

// =====================================important link related routes===================================================================

router
  .route("/getall/importantlink")
  .get(isTmsUserAuthenticated,tenantMiddleware, getImportantLinkList);
router
  .route("/add/importantlink")
  .post(isTmsUserAuthenticated,tenantMiddleware, addImportantLink);
router
  .route("/update/importantlink")
  .patch(isTmsUserAuthenticated,tenantMiddleware, updateImportantLink);
router
  .route("/delete/importantlink")
  .patch(isTmsUserAuthenticated,tenantMiddleware, deleteImportantLink);

// =====================================policy related routes===================================================================
router.route("/getall/policy").get(isTmsUserAuthenticated,tenantMiddleware, getPolicyList);
router.route("/add/policy").post(isTmsUserAuthenticated,tenantMiddleware, addPolicy);
router.route("/update/policy").patch(isTmsUserAuthenticated,tenantMiddleware, updatePolicy);
router.route("/delete/policy").patch(isTmsUserAuthenticated, tenantMiddleware,deletePolicy);

module.exports= router;
