const express = require("express");
const router = express.Router();
const {
    isTmsUserAuthenticated,
  } = require("../../../middlewares/isAuthenticated");
const {
  createKeyValuePairApproval, 
  getKeyValuePairApprovals, 
  updateKeyValuePairApprovalStatus, 
  deleteKeyValuePairApproval, 
  updateKeyValuePairOnApproval, 
  getAllKP, 
  getAllCategoryKeyValues, 
  deleteKeyValuePair, 
  ClearKeyValueCache, 
  createCategoryKeyValue,
  updateCategoryKeyValuePairById,
  deleteCategoryKeyValuePairById,
  createKeyValuePair,
} = require("../../../controllers/tools/keyValuePair/keyValuePairApprovalController");

// Define the POST route
router.route("/key-value-pair-approval").post(isTmsUserAuthenticated, createKeyValuePairApproval);

// Define the GET route
router.route("/key-value-pair-approvals").get(isTmsUserAuthenticated, getKeyValuePairApprovals);

// Define the PATCH route
router.route("/key-value-pair-approval/:id").patch(isTmsUserAuthenticated, updateKeyValuePairApprovalStatus);

// Define the DELETE route
router.route("/key-value-pair-approval/:id").delete(isTmsUserAuthenticated, deleteKeyValuePairApproval);

// Define the PATCH route for updating KeyValuePairs on approval
router.route("/key-value-pair/:id").patch(isTmsUserAuthenticated, updateKeyValuePairOnApproval);

router.route("/getAllKP").get(isTmsUserAuthenticated, getAllKP);

router.route("/getAllCategoryKP").get(isTmsUserAuthenticated,getAllCategoryKeyValues);

router.route("/delete/:id").patch(isTmsUserAuthenticated, deleteKeyValuePair);
//This route is used to clear the cache for the KeyValuePairs
router.route("/clear-cache").post(isTmsUserAuthenticated,ClearKeyValueCache);

router.route("/category/create").post(isTmsUserAuthenticated, createCategoryKeyValue);
router.route("/category/update/:id").patch(isTmsUserAuthenticated, updateCategoryKeyValuePairById);

router.route("/category/delete/:id").patch(isTmsUserAuthenticated, deleteCategoryKeyValuePairById);

router.route("/create").post(isTmsUserAuthenticated, createKeyValuePair);

module.exports = router;
