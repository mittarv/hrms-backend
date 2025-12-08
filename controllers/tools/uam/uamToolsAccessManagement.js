const { dbOutput } = require("../../../models/index");
const UamToolsDetails = dbOutput.uamToolDetails;
const UamToolsUsers = dbOutput.uamToolUsers;
const UamUserGroups = dbOutput.uamUserGroups;

// This api used to give access to user for various tools
exports.uamToolsAccess = async (req, res) => {
  try {
    const { userId, toolName } = req.body;
    const toolId = await UamToolsDetails.findOne({
      where: { name: toolName, isDeleted: false },
    });
    // Checking whether the tool present or not
    if (!toolId) {
      res.status(400).json({
        success: false,
        message: `Tool is not created on the UAM, please create ${toolName}`,
      });
      return;
    }
    // getting groupid
    const groupid = await UamToolsUsers.findOne({
      where: { userId: userId, toolId: toolId["dataValues"].toolId },
      attributes: ["userGroupId"],
    });

    // there is no group id means that user don't have access
    if (!groupid) {
      return res.status(400).json({
        success: false,
        havePermission: false,
        message: `You Don't Have Access For ${toolName}`,
      });
    }
    const roleandValue = await UamUserGroups.findOne({
      where: { id: groupid["dataValues"].userGroupId },
      attributes: ["role", "value"],
    });
    if (!roleandValue) {
      res.status(200).json({
        success: false,
        message: `There is no tool name with your id`,
      });
    }
    if(roleandValue.role === "No Access"){
        res.status(200).json({
            success : false,
            message : `You Don't Have Access For This Tool`,
            havePermission : false,
            roleandValue: roleandValue
        })
        return;
    }
    if (roleandValue) {
      res.status(200).json({
        success: true,
        havePermission: true,
        roleAndValue: roleandValue,
        message: "The access tools fetched successfully",
      });
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
