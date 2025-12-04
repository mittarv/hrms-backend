const express = require('express');
const router = express.Router();
const { healthCheck,getDetailInfo  } = require("../controllers/techController");

router.route('/').get(healthCheck)
router.route('/details').get(getDetailInfo)

module.exports = router;