const { dbOutput } = require("../../models/index");
const TmsUsers = dbOutput.tmsUsers;
const employeeContactDetails = dbOutput.employeeContactDetails;
const jwt = require("jsonwebtoken");


// This API will be used to check if the user already exists or not. If yes then we send token else send null after which we perform createTmsUser
exports.tmsUserGoogleLogin = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await TmsUsers.findOne({
      where: { email: email, isDeleted: false },
    });
    if (user) {
      //signing the token with the userId of the tms user,if the user is present in the database
      const encodedUser = jwt.sign(
        { 
          id: user.userId,
          email: user.email,
          env:process.env.NODE_ENV,
        },
        process.env.SECRET_KEY,
        {
          expiresIn: "30d",
        }
      );
      console.log(encodedUser);
      //=======================now the token will carry only the userId of the user,we can fetch the whole user using the userId in the middleware function============================================
      return res.status(200).json({
        success: true,
        message: "User logged in successfully",
        token: encodedUser,
      });
    } else {
      return res
        .status(400)
        .json({ success: false, user: null, message: "User does not exists" });
    }
  } catch (error) {
    return res
      .status(400)
      .json({ success: false, user: null, message: "User does not exists" });
  }
};

exports.createTmsUser = async (req, res) => {
  // 100 for normal user, 500 for tool admin ( which is also a normal user for other tools ) and 900 for super admin
  try {
    var { email, name, profilePic } = req.body;
    if (email == null || name == null || profilePic == null) {
      return res
        .status(400)
        .json({ success: false, message: "Please fill all the details" });
    } else {
      let userType = 100;
      await TmsUsers.create({
        email,
        name,
        userType,
        profilePic,
      });
      const newCreatedUser = await TmsUsers.findOne({
        where: { email: email, isDeleted: false },
      });
      if (!newCreatedUser) {
        return res
          .status(400)
          .json({ success: false, message: "User not created" });
      }
      const token = jwt.sign(
        { id: newCreatedUser.userId },
        process.env.SECRET_KEY,
        {
          expiresIn: "30d",
        }
      );
      return res.status(201).json({
        success: true,
        token: token,
        message: "User added to UAM tool succesfully",
      });
    }
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

exports.createTmsUserWithoutLogin = async (req, res) => {
  try {

    let { name, email } = req.body;
    if (email == null || name == null) {
      return res
        .status(400)
        .json({ success: false, message: "Please fill all the details" });
    } else {
      let userType = 100;
      let user = await TmsUsers.create({
        email,
        name,
        userType,
      });


      if (user) {
        return res.status(201).json({ success: true, user: user, message: "User created successfully" });
      } else {
        return res
          .status(400)
          .json({ success: false, message: "User not created" });
      }
    }

  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

exports.getUserDetailsById = async (req, res) => {
  try {
    const { user } = req;

    //Fetching the employeeUuid based on email
    const employeeUuid = await employeeContactDetails.findOne({
      attributes : ['empUuid'],
      where: { empOfficialEmail: user.email},
    });

    //Adding the employeeUuid to the response
    const response = { ...user, employeeUuid: employeeUuid?.empUuid || null }
    
    res.status(200).json({ success: true, user: response});

    
    //we don't need the below code as we are already fetching the user in the middleware function
    // var userId = req.user.userId;
    // const user = await TmsUsers.findOne({
    //   where: { userId },
    // });
    // if (!user) {
    //   return res
    //     .status(404)
    //     .json({ success: false, message: "User does not exist" });
    // }
    // const decodedUser = jwt.sign({ user: user }, process.env.SECRET_KEY, {
    //   expiresIn: "30d",
    // });
    // return res.status(201).json({
    //   success: true,
    //   user: decodedUser,
    //   message: "User fetched successfully",
    // });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

exports.getAllUserDetails = async (req, res) => {
  try {
    const user = await TmsUsers.findAll({ where: { isDeleted: false }, });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User does not exist" });
    }
    
    return res
      .status(201)
      .json({ success: true, user, message: "User fetched successfully" });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};
//This API is only accessable to the Super Admin
exports.updateUserDetailsById = async (req, res) => {
  try {
    const userId = req.params.id;
    const requestedBy = req.user;
    var { userType, startDate, endDate } = req.body;
    //Fetch the User to check the User Type
    //Case -> If 900 (SA) -> Continue , else quit
    const requestedByUser = await TmsUsers.findOne({where:{ userId: requestedBy.userId, isDeleted: false }});
    if (requestedByUser.userType !== 900) {
      return res
        .status(200)
        .json({ success: false, message: "You don't have permission to change the user type" });
    }
    const user = await TmsUsers.update(
      {
        userType,
        startDate,
        endDate,
      },
      {
        where: { userId, isDeleted: false },
      }
    );
    if (!user[0]) {
      return res
        .status(404)
        .json({ success: false, message: "User does not exist" });
    }
    return res
      .status(201)
      .json({ success: true, user, message: "User fetched successfully"});
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};



exports.removeUserById = async (req, res) => {
  try {
    const userId = req.params.id;
    await TmsUsers.update(
      {
        isDeleted: true,
      },
      {
        where: { userId },
      });
    return res
      .status(201)
      .json({ success: true, message: "User removed from UAM successfully" });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};
