const { dbOutput } = require("../../models/index");
const TmsUsers = dbOutput.tmsUsers;
const employeeContactDetails = dbOutput.employeeContactDetails;
const jwt = require("jsonwebtoken");
const { googleClient, verifyGoogleToken } = require("../../utilities/validateGoogleIdToken");

const SUPER_ADMIN_EMAILS = process.env.TMS_SUPER_ADMIN_EMAILS
  ? process.env.TMS_SUPER_ADMIN_EMAILS.split(",").map((e) => e.trim().toLowerCase())
  : [];

const ALLOWED_DOMAINS = process.env.TMS_ALLOWED_DOMAINS
  ? process.env.TMS_ALLOWED_DOMAINS.split(",").map((d) => d.trim().toLowerCase())
  : ["mittarv.com"];

const isAllowedDomain = (email) => {
  const domain = email.split("@")[1]?.toLowerCase();
  return domain && ALLOWED_DOMAINS.includes(domain);
};

const exchangeCodeAndGetUser = async (code) => {
  const { tokens } = await googleClient.getToken(code);
  if (!tokens || !tokens.id_token) {
    throw new Error("Failed to exchange authorization code");
  }
  const payload = await verifyGoogleToken(tokens.id_token);
  if (!payload || !payload.email) {
    throw new Error("Failed to verify Google token");
  }
  if (!payload.email_verified) {
    throw new Error("Google email is not verified");
  }
  return payload;
};

exports.tmsUserGoogleLogin = async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Authorization code is required",
      });
    }

    const googleUser = await exchangeCodeAndGetUser(code);
    const email = googleUser.email;
    const name = googleUser.name;
    const profilePic = googleUser.picture;

    if (!isAllowedDomain(email)) {
      return res
        .status(403)
        .json({ success: false, message: `Please use your ${ALLOWED_DOMAINS.join(", ")} email to login` });
    }

    let user = await TmsUsers.findOne({
      where: { email: email, isDeleted: false },
    });

    if (!user && name && profilePic) {
      try {
        const [newUser] = await TmsUsers.findOrCreate({
          where: { email: email, isDeleted: false },
          defaults: {
            email,
            name,
            userType: SUPER_ADMIN_EMAILS.includes(email.toLowerCase()) ? 900 : 100,
            profilePic,
          },
        });
        user = newUser;
      } catch (createError) {
        console.error("Error auto-creating user:", createError);
        user = await TmsUsers.findOne({
          where: { email: email, isDeleted: false },
        });
      }
    }

    if (user) {
      const encodedUser = jwt.sign(
        {
          id: user.userId,
          email: user.email,
          env: process.env.NODE_ENV,
        },
        process.env.SECRET_KEY,
        { expiresIn: "30d" }
      );
      return res.status(200).json({
        success: true,
        message: "User logged in successfully",
        token: encodedUser,
      });
    } else {
      return res
        .status(400)
        .json({ success: false, user: null, message: "User does not exist" });
    }
  } catch (error) {
    return res
      .status(400)
      .json({ success: false, user: null, message: error.message || "Login failed" });
  }
};

exports.createTmsUser = async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res
        .status(400)
        .json({ success: false, message: "Authorization code is required" });
    }

    const googleUser = await exchangeCodeAndGetUser(code);
    const email = googleUser.email;
    const name = googleUser.name;
    const profilePic = googleUser.picture;

    if (!isAllowedDomain(email)) {
      return res
        .status(403)
        .json({ success: false, message: `Please use your ${ALLOWED_DOMAINS.join(", ")} email to login` });
    }

    if (!name || !profilePic) {
      return res
        .status(400)
        .json({ success: false, message: "Please fill all the details" });
    }

    const existingUser = await TmsUsers.findOne({
      where: { email: email, isDeleted: false },
    });

    if (existingUser) {
      const token = jwt.sign(
        {
          id: existingUser.userId,
          email: existingUser.email,
          env: process.env.NODE_ENV,
        },
        process.env.SECRET_KEY,
        { expiresIn: "30d" }
      );
      return res.status(200).json({
        success: true,
        token: token,
        message: "User already exists, logged in successfully",
      });
    }

    var userType = SUPER_ADMIN_EMAILS.includes(email.toLowerCase()) ? 900 : 100;
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
      {
        id: newCreatedUser.userId,
        email: newCreatedUser.email,
        env: process.env.NODE_ENV,
      },
      process.env.SECRET_KEY,
      { expiresIn: "30d" }
    );
    return res.status(201).json({
      success: true,
      token: token,
      message: "User added to UAM tool succesfully",
    });
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
    }

    if (!isAllowedDomain(email)) {
      return res
        .status(403)
        .json({ success: false, message: `Only ${ALLOWED_DOMAINS.join(", ")} emails are allowed` });
    }

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
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

exports.getUserDetailsById = async (req, res) => {
  try {
    const { user } = req;

    const employeeUuid = await employeeContactDetails.findOne({
      attributes : ['empUuid'],
      where: { empOfficialEmail: user.email},
    });

    const response = { ...user, employeeUuid: employeeUuid?.empUuid || null }

    res.status(200).json({ success: true, user: response});
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

exports.updateUserDetailsById = async (req, res) => {
  try {
    const userId = req.params.id;
    const requestedBy = req.user;
    var { userType, startDate, endDate } = req.body;
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
