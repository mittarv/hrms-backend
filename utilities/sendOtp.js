const { Op } = require("sequelize");
const { db } = require("../models/index");
const TempOtpInfo = db.tempotpinfo;
const TempPhoneOtp = db.tempPhoneOtp;

exports.createOTP = async (email) => {
  try {
    const existingTempUser = await TempOtpInfo.findOne({
      where: { email: email },
    });
    if (existingTempUser) {
      existingTempUser.destroy({ where: { email: email } });
    }
    const otp = Math.floor(100000 + Math.random() * 900000);
    const isOtpCreated = await TempOtpInfo.create({
      email,
      otp,
      otp_expiry: new Date(Date.now() + 2 * 60 * 1000),
    });
    return otp;
  } catch (error) {
    return null;
  }
};

/*
    1. this function is used to create otp for phone number validation
    2. it takes two parameters number and userId from the req.body
    3. it checks if the otp already exists for the user and phone number

*/

exports.createOtpForPhoneNumberValidation = async (number, userId) => {
  try {
    // destroying the existing otp record if it exists
    await TempPhoneOtp.destroy({
      where: {
        userId: userId,
        phone: number,
        otpExpiry: { [Op.lt]: new Date() },
      },
    });
    const existingTempOtp = await TempPhoneOtp.findOne({
      where: {
        userId: userId,
        phone: number,
      },
    });

    // ======checking if the user is sending request within 120 seconds================
    if (existingTempOtp) {
      const expiryTime = new Date(existingTempOtp.otpExpiry).getTime();
      if (expiryTime > Date.now()) {
        return {
          success: false,
          message: "Please try after 120 seconds",
          otp: null,
        };
      }
    }
    // if the record is not exits in the database, then simply create the otp and send it to the user phone number
    const otp = Math.floor(100000 + Math.random() * 900000);
    await TempPhoneOtp.create({
      userId,
      phone: number,
      otp,
      otpExpiry: new Date(Date.now() + 2 * 60 * 1000),
    });
    return { success: true, message: "OTP Generate", otp: otp };
  } catch (error) {
    // console.log("returning from catch block", error);

    return { success: false, message: error, otp: null };
  }
};
