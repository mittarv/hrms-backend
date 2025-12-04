import express from "express";
import { isAuthenticated } from "../../../middlewares/isAuthenticated";
import { getAllAvailableLanguagesOnPlatform, getUserSelectedLanguage, submitUserLanguageSuggestion, updateUserSelectedLanguage } from "../../../controllers/platform/regionalSettings/userSelectedLanguageController";
const router = express.Router();

router.route("/user/get").get(isAuthenticated, getUserSelectedLanguage);
/**
 * @swagger
 * /api/platform/regionalSettings/language/user/get: 
 *   get:
 *     tags:
 *       - My Language
 *     summary: Get user’s selected language.
 *     description: |
 *      This API returns the language selected by the authenticated user.
 *     security:
 *       - customAuth: []
 *     responses:
 *       200:
 *         description: Returns the user's selected language
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *       500:
 *         description: Internal server error
 */
router.route("/user/update").patch(isAuthenticated, updateUserSelectedLanguage);
/**
 * @swagger
 * /api/platform/regionalSettings/user/update:
 *   patch:
 *     tags:
 *       - My Language
 *     summary: Update Language
 *     description: |
 *       This API updates the language selected by the authenticated user.
 *     security:
 *       - customAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               languageId:
 *                 type: string
 *                 example: en
 *     responses:
 *       200:
 *         description: User's selected language updated successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *       500:
 *         description: Internal server error
 */
router.route("/getAll").get(isAuthenticated, getAllAvailableLanguagesOnPlatform);
/**
 * @swagger
 * /api/platform/regionalSettings/language/getAll:
 *   get:
 *     tags:
 *       - My Language
 *     summary: Get all available languages
 *     description: |
 *        This API returns all the languages available on the platform
 *     security:
 *       - customAuth: []
 *     responses:
 *       200:
 *         description: Returns the list of available languages
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *       500:
 *         description: Internal server error
 */

router
  .route("/user/suggestion")
  .post(isAuthenticated, submitUserLanguageSuggestion);


export default router;