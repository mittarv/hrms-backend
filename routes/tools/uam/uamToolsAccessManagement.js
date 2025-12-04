const express = require("express")
const router = express.Router();
const {uamToolsAccess} = require("../../../controllers/tools/uam/uamToolsAccessManagement");
// this file has api - "whether user get access for the particular tool or not"
router.route("/tool/access").post(uamToolsAccess);

module.exports = router;