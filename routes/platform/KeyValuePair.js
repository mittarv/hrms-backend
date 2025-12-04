const express = require("express");
const {
  createKeyValuePair,
  getKeyValuePairs,
  updateKeyValuePair,
  deleteKeyValuePair,
  getAllKP,
  replaceDeilverTypeValuesOfRealTime,
  replaceDeliverTypesOfSheredAssets,
  getValuesByCategory,
  createCategoryKeyValue,
  getCategoryKeyValue,
  getSasToken,
  getSasTokenV2,
  getCategoryKeyValuePairByCategoryAndKey,
  updateCategoryKeyValuePairById,
  deleteCategoryKeyValuePairById,
  getMinVersion,
  getAllCategoryKeyValues
} = require("../../controllers/platform/KeyValuePairController");
const { isAuthenticated } = require("../../middlewares/isAuthenticated");
const router = express.Router();

// Deprecated API's
router.route("/getSas").get(getSasToken);

// API's to be used
router.route("/create").post(createKeyValuePair);
router.route("/category/create").post(isAuthenticated, createCategoryKeyValue);
router.route("/category/get").get(getCategoryKeyValuePairByCategoryAndKey);
router.route("/category/getAll").post(isAuthenticated, getCategoryKeyValue);
router.route("/getSasV2").get(getSasTokenV2);
router.route("/getAll").get(getKeyValuePairs);
router.route("/getAllKP").get(isAuthenticated, getAllKP);
router.route("/getAllCategoryKP").get(isAuthenticated, getAllCategoryKeyValues);
router.route("/getvalues/").get(getValuesByCategory);
router.route("/update/:id").patch(isAuthenticated, updateKeyValuePair);
router.route("/category/update/:id").patch(isAuthenticated, updateCategoryKeyValuePairById);
router.route("/delete/:id").patch(isAuthenticated, deleteKeyValuePair);
router.route("/category/delete/:id").patch(isAuthenticated, deleteCategoryKeyValuePairById);
router.route("/fetchMinVersion").get(getMinVersion);

//Replace deliver types
router
  .route("/update/kp/delivertype/:id")
  .patch(clearCache(), isAuthenticated, replaceDeilverTypeValuesOfRealTime);
router
  .route("/update/shareassets/delivertype")
  .patch(clearCache(), isAuthenticated, replaceDeliverTypesOfSheredAssets);

module.exports = router;
