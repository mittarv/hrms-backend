const express = require("express");
const {
  sendDataToAzureEventHub,
} = require("../../controllers/loggingController/loggingController");
const router = express.Router();

// not addning isAuthenticated middleware here because we have to catch all the logs when the user is not logged in into the fluter app
router.route("/sendlog").post(sendDataToAzureEventHub);

module.exports = router;
