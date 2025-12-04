const {
  getUserCountries,
  getAllCountries,
  updatePrimaryCountry,
  getAllAdditionalCountries,
  addAdditionalCountry,
  removeAdditionalCountry,
  updateResidentialCountry,
  makeAdditionalCountryPrimary,
  getAssetsScheduledForDeletion
} = require("../../../controllers/platform/regionalSettings/userCountriesController");
const router = require("express").Router();
const { isAuthenticated } = require("../../../middlewares/isAuthenticated");

router.route("/getAll").get(getAllCountries); // GET request to get all countries
/**
 * @swagger
 * /api/platform/regionalSettings/userCountries/getAll:
 *   get:
 *     tags:
 *       - User Countries
 *     summary: Get all countries
 *     description: |
 *        This API returns a list of all available countries.
 *     responses:
 *       200:
 *         description: List of all countries
 *       500:
 *         description: Internal server error
 */
router.route("/additionalCountries/getAll").get(isAuthenticated, getAllAdditionalCountries); // GET request to get all additional countries for a user basically this will return countries that are activated in the av tool
/**
 * @swagger
 * /api/platform/regionalSettings/userCountries/additionalCountries/getAll:
 *   get:
 *     tags:
 *       - User Countries
 *     summary: Get All Additional countries except for the chosen primary country.
 *     description: |
 *      This API returns the list of all the additional countries except the chosen primary country.
 *     security:
 *       - customAuth: []
 *     responses:
 *       200:
 *         description: List of additional countries for the user
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *       500:
 *         description: Internal server error
 */
router.route("/additionalCountries/add").post(isAuthenticated, addAdditionalCountry); // POST request to add additional country for a user where user is premium user
/**
 * @swagger
 * /api/platform/regionalSettings/userCountries/additionalCountries/add:
 *   post:
 *     tags:
 *       - User Countries
 *     summary:  Add Additional Country
 *     description: |
 *       This API adds an additional country for an authenticated user.
 *     security:
 *       - customAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               countryId:
 *                 type: integer
 *                 description: ID of the country to add
 *                 example: 1
 *             required:
 *               - countryId
 *     responses:
 *       200:
 *         description: Country added successfully
 *       400:
 *         description: Invalid input or country already added
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *       500:
 *         description: Internal server error
 */
router.route("/additionalCountries/remove").patch(isAuthenticated, removeAdditionalCountry); // PATCH request to remove additional country for a user where user is premium user 
/**
 * @swagger
 * /api/platform/regionalSettings/userCountries/additionalCountries/remove:
 *   patch:
 *     tags:
 *       - User Countries
 *     summary:  Remove an additional country
 *     description: |
 *      This API removes an additional country for an authenticated user.
 *     security:
 *       - customAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               countryId:
 *                 type: integer
 *                 description: ID of the country to remove
 *                 example: 6
 *               retainAssets:
 *                 type: boolean
 *                 description: Whether to retain assets associated with this country
 *                 example: false
 *             required:
 *               - countryId
 *               - retainAssets
 *     responses:
 *       200:
 *         description: Country removed successfully
 *       400:
 *         description: Invalid input or country not found
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *       500:
 *         description: Internal server error
 */

router.route("/getUserCountries").get(isAuthenticated, getUserCountries); // GET request to get user countries returns three object   primaryCountry, residentialCountry, additionalCountries
/**
 * @swagger
 * /api/platform/regionalSettings/userCountries/getUserCountries:
 *   get:
 *     tags:
 *       - User Countries
 *     summary:  Get user countries (Primary, Country of Residence, & Additional Countries)
 *     description: |
 *        This API returns the user countries (Primary, Country of Residence, & Additional Countries).
 *     security:
 *       - customAuth: []
 *     responses:
 *       200:
 *         description: User countries fetched successfully
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *       500:
 *         description: Internal server error
 */
router.route("/updatePrimaryCountry").patch(isAuthenticated, updatePrimaryCountry); // PATCH request to update primary country
/**
 * @swagger
 * /api/platform/regionalSettings/userCountries/updatePrimaryCountry:
 *   patch:
 *     tags:
 *       - User Countries
 *     summary: Update Primary Country
 *     description: |
 *       This API updates the primary country for an authenticated user.
 *     security:
 *       - customAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               countryId:
 *                 type: integer
 *                 description: ID of the new primary country
 *                 example: 2
 *               retainAssets:
 *                 type: boolean
 *                 description: Whether to retain assets associated with the previous primary country
 *                 example: false
 *             required:
 *               - countryId
 *               - retainAssets
 *     responses:
 *       200:
 *         description: Primary country updated successfully
 *       400:
 *         description: Invalid input or country not found
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *       500:
 *         description: Internal server error
 */
router.route("/updateResidentialCountry").patch(isAuthenticated, updateResidentialCountry); // PATCH request to update residential country
router.route("/additionalCountries/markPrimary").patch(isAuthenticated, makeAdditionalCountryPrimary); // PATCH request to update residential country
/**
 * @swagger
 * /api/platform/regionalSettings/userCountries/additionalCountries/markPrimary:
 *   patch:
 *     tags:
 *       - User Countries
 *     summary: Make additional countries as the primary country.
 *     description: |
 *      This API sets one of the additional countries as the primary country.
 *     security:
 *       - customAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               countryId:
 *                 type: integer
 *                 description: ID of the additional country to make primary
 *                 example: 3
 *             required:
 *               - countryId
 *     responses:
 *       200:
 *         description: Additional country set as primary successfully
 *       400:
 *         description: Invalid input or country not found
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *       500:
 *         description: Internal server error
 */
router.route("/getAssetsScheduledForDeletion").get(isAuthenticated, getAssetsScheduledForDeletion)

module.exports = router;
