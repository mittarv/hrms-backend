const { dbOutput } = require("../../models/index");
const { createUUIDV4 } = require("../../utilities/uuidV4Generator");
const { Op } = require("sequelize");
const TmsUsers = dbOutput.tmsUsers;
const employeeContactDetails = dbOutput.employeeContactDetails;
const jwt = require("jsonwebtoken");
const { googleClient, verifyGoogleToken } = require("../../utilities/validateGoogleIdToken");

const SUPER_ADMIN_EMAILS = process.env.TMS_SUPER_ADMIN_EMAILS
  ? process.env.TMS_SUPER_ADMIN_EMAILS.split(",").map((e) => e.trim().toLowerCase())
  : [];

// Domain-based auth removes the need for hardcoded ALLOWED_DOMAINS
// The domain will be checked against the Organization table (verifiedDomain)



exports.tmsUserGoogleLogin = async (req, res) => {
  try {
    const { token: googleToken } = req.body;

    if (!googleToken) {
      return res.status(400).json({
        success: false,
        message: "Google ID token is required",
      });
    }

    const payload = await verifyGoogleToken(googleToken);
    if (!payload || !payload.email) {
      throw new Error("Failed to verify Google token");
    }
    if (!payload.email_verified) {
      throw new Error("Google email is not verified");
    }
    
    const email = payload.email;
    const name = payload.name;
    const profilePic = payload.picture;

    const emailDomain = email.split("@")[1]?.toLowerCase();
    
    // Domain-Based Tenant Resolution (Atlassian Model)
    let organization = null;
    let isGuest = false;
    let redirectSubdomain = null;

    if (dbOutput.organization) {
      console.log(`[SSO] Looking up org for domain: "${emailDomain}"`);
      organization = await dbOutput.organization.findOne({
        where: { allowedDomain: emailDomain, status: 'ACTIVE', isDeleted: false }
      });
      console.log(`[SSO] Organization found:`, organization ? `${organization.name} (subdomain: ${organization.subdomain})` : 'NONE');
    } else {
      console.warn(`[SSO] dbOutput.organization model not loaded! Check BUILD_TARGET env var.`);
    }

    if (organization) {
      redirectSubdomain = organization.subdomain;
    } else {
      isGuest = true;
    }
    console.log(`[SSO] Result: redirectSubdomain=${redirectSubdomain}, isGuest=${isGuest}`);

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
            userType: organization?.adminEmail === email ? 900 : (isGuest ? 10 : 100),
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

    // Auto-assign user as organization-scoped ADMIN if they are the Organization Admin
    if (user && organization && organization.adminEmail && organization.adminEmail.toLowerCase() === email.toLowerCase()) {
      const UserOrganizationMapping = dbOutput.userOrganizationMapping;
      if (UserOrganizationMapping) {
        let existingMapping = await UserOrganizationMapping.findOne({
          where: { userId: user.userId, organizationId: organization.id, isDeleted: false }
        });
        if (!existingMapping) {
          await UserOrganizationMapping.create({
            userId: user.userId,
            organizationId: organization.id,
            role: "ADMIN"
          });
        } else if (existingMapping.role !== "ADMIN") {
          existingMapping.role = "ADMIN";
          await existingMapping.save();
        }
      }
    }

    // Auto-create HRMS Admin employee profile during first SSO login if the user is an Admin
    if (user && organization && (user.userType === 900 || user.userType === 100 || (organization.adminEmail && organization.adminEmail.toLowerCase() === email.toLowerCase()))) {
      try {
        const EmployeeContactDetails = dbOutput.employeeContactDetails;
        const EmployeeBasicDetails = dbOutput.employeeBasicDetails;
        const EmployeeJobDetails = dbOutput.employeeJobDetails;
        if (EmployeeContactDetails && EmployeeBasicDetails) {
          let existingEmpInOrg = null;
          const contactRows = await EmployeeContactDetails.findAll({
            where: { empOfficialEmail: email, isDeleted: false },
            attributes: ['empUuid'],
            raw: true
          });
          if (contactRows && contactRows.length > 0) {
            const empUuids = contactRows.map((r) => r.empUuid);
            existingEmpInOrg = await EmployeeBasicDetails.findOne({
              where: { empUuid: { [Op.in]: empUuids }, empCompanyId: organization.id, isDeleted: false }
            });
          }

          if (!existingEmpInOrg) {
            const newUuid = await createUUIDV4();
            await EmployeeContactDetails.create({
              contactId: await createUUIDV4(),
              empOfficialEmail: email,
              empUuid: newUuid
            });
            const nameParts = (name || "Admin").split(" ");
            const firstName = nameParts[0] || "Admin";
            const lastName = nameParts.slice(1).join(" ") || "";
            await EmployeeBasicDetails.create({
              empUuid: newUuid,
              empFirstName: firstName,
              empLastName: lastName,
              empCompanyId: organization.id,
              isManager: true,
              empHireDate: new Date()
            });
            if (EmployeeJobDetails) {
              await EmployeeJobDetails.create({
                jobId: await createUUIDV4(),
                empType: "",
                empTitle: "Admin",
                empDepartment: "",
                empUuid: newUuid,
                effectiveDate: new Date()
              });
            }
            console.log(`[SSO] Auto-created employee profile for admin ${email} (${newUuid}) in tenant ${organization.id}`);
          }
        }
      } catch (empCreateErr) {
        console.error(`[SSO] Error auto-creating HRMS employee profile for admin:`, empCreateErr);
      }
    }

    if (user) {
      const encodedUser = jwt.sign(
        {
          id: user.userId,
          email: user.email,
          env: process.env.NODE_ENV,
          tenantId: organization ? organization.id : null,
        },
        process.env.SECRET_KEY,
        { expiresIn: "30d" }
      );
      return res.status(200).json({
        success: true,
        message: "User logged in successfully",
        token: encodedUser,
        redirectSubdomain,
        isGuest,
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
    const { token: googleToken } = req.body;

    if (!googleToken) {
      return res
        .status(400)
        .json({ success: false, message: "Google ID token is required" });
    }

    const payload = await verifyGoogleToken(googleToken);
    if (!payload || !payload.email) {
      throw new Error("Failed to verify Google token");
    }
    if (!payload.email_verified) {
      throw new Error("Google email is not verified");
    }

    const email = payload.email;
    const name = payload.name;
    const profilePic = payload.picture;

    if (!name || !profilePic) {
      return res
        .status(400)
        .json({ success: false, message: "Please fill all the details" });
    }

    const emailDomain = email.split("@")[1]?.toLowerCase();
    let organization = null;
    if (dbOutput.organization) {
      organization = await dbOutput.organization.findOne({
        where: { allowedDomain: emailDomain, status: 'ACTIVE', isDeleted: false }
      });
    }

    if (!organization && !isAllowedDomain(email)) {
      return res
        .status(403)
        .json({ success: false, message: `Domain not registered in Organization and not in allowed domains list` });
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
          tenantId: organization ? organization.id : null,
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
        tenantId: organization ? organization.id : null,
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

    const emailDomain = email.split("@")[1]?.toLowerCase();
    let organization = null;
    if (dbOutput.organization) {
      organization = await dbOutput.organization.findOne({
        where: { allowedDomain: emailDomain, status: 'ACTIVE', isDeleted: false }
      });
    }

    if (!organization && !isAllowedDomain(email)) {
      return res
        .status(403)
        .json({ success: false, message: `Domain not registered in Organization and not in allowed domains list` });
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

    // Resolve the user's org subdomain for frontend redirect
    let redirectSubdomain = null;
    
    if (dbOutput.organization && req.tenantId) {
      const org = await dbOutput.organization.findOne({
        where: { id: req.tenantId, status: 'ACTIVE', isDeleted: false }
      });
      if (org) {
        redirectSubdomain = org.subdomain;
      }
    }

    const response = { ...user, employeeUuid: employeeUuid?.empUuid || null, redirectSubdomain }

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

exports.switchTenant = async (req, res) => {
  try {
    const token = req.headers?.authorization;
    if (!token) {
      return res.status(401).json({ success: false, message: "No token provided" });
    }
    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    const { targetSubdomain } = req.body;

    const Organization = dbOutput.organization;
    let targetOrg = null;
    if (Organization && targetSubdomain) {
      targetOrg = await Organization.findOne({
        where: { subdomain: targetSubdomain, status: 'ACTIVE', isDeleted: false },
        raw: true
      });
    }

    if (!targetOrg) {
      return res.status(404).json({ success: false, message: "Organization not found" });
    }

    // Verify user has access to target tenant
    const mapping = await dbOutput.userOrganizationMapping.findOne({
      where: { userId: decoded.id, organizationId: targetOrg.id, isDeleted: false }
    });

    if (!mapping) {
      return res.status(403).json({ success: false, message: "No access to this organization" });
    }

    // Issue new token with updated tenantId
    const newToken = jwt.sign(
      { id: decoded.id, email: decoded.email, env: decoded.env, tenantId: targetOrg.id },
      process.env.SECRET_KEY,
      { expiresIn: "30d" }
    );

    return res.status(200).json({ success: true, token: newToken });
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
};
