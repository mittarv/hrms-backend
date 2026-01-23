const express = require('express');
const router = express.Router();

const {
    getAllCountries,
    addNewCountry,
    updateCountryByCountryIsoCode,
    deleteCountryByCountryIsoCode
} = require("../../controllers/platform/allCountryController");
const { isAuthenticated } = require("../../middlewares/isAuthenticated");
const { cache, clearCache } = require('../../middlewares/redis');

router.route("/getAll").get(cache(), getAllCountries);
router.route("/addCountry").post(isAuthenticated, clearCache(), addNewCountry);
router.route("/updateCountry").patch(isAuthenticated, clearCache(), updateCountryByCountryIsoCode);
router.route("/deleteCountry").delete(isAuthenticated, clearCache(), deleteCountryByCountryIsoCode);

module.exports = router;