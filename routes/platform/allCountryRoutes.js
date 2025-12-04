const express = require('express');
const router = express.Router();

const {
    getAllCountries,
    addNewCountry,
    updateCountryByCountryIsoCode,
    deleteCountryByCountryIsoCode
} = require("../../controllers/platform/allCountryController");
const { isAuthenticated } = require("../../middlewares/isAuthenticated");

router.route("/getAll").get(getAllCountries);
router.route("/addCountry").post(isAuthenticated, addNewCountry);
router.route("/updateCountry").patch(isAuthenticated, updateCountryByCountryIsoCode);
router.route("/deleteCountry").delete(isAuthenticated, deleteCountryByCountryIsoCode);

module.exports = router;