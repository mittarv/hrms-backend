require("dotenv").config();


exports.isNotProduction = async (req, res, next) => {
  try {
    if (process.env.NODE_ENV.toLowerCase() === "production") {
      return res.status(400).json({
        success: false,
        message: "Unauthorized",
      });
    }
    next();
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};
