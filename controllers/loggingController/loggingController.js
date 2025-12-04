// const {express}= require('express')

const { logData } = require("../../apiLogging/sendData");

// const router = express.Router();

// router.post

// module.exports = router;

exports.sendDataToAzureEventHub = async (req, res) => {
  try {
    const { eventData } = req.body;
    if (!eventData) {
      return res
        .status(400)
        .json({ succes: false, message: "Event data is missing" });
    }
    logData(eventData);
    
    return res
      .status(200)
      .json({ success: true, message: "Data sent successfully" });
  } catch (error) {
    return res.status(500).json({ success: true, message: error.message });
  }
};
