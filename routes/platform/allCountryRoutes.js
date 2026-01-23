const express = require('express');
const router = express.Router();

const {
    getAllCountries,
    addNewCountry,
    updateCountryByCountryIsoCode,
    deleteCountryByCountryIsoCode
} = require("../../controllers/platform/allCountryController");
const { isTmsUserAuthenticated } = require("../../middlewares/isAuthenticated");

router.route("/getAll").get(getAllCountries);
router.route("/addCountry").post(isTmsUserAuthenticated, addNewCountry);
router.route("/updateCountry").patch(isTmsUserAuthenticated, updateCountryByCountryIsoCode);
router.route("/deleteCountry").delete(isTmsUserAuthenticated, deleteCountryByCountryIsoCode);

module.exports = router;