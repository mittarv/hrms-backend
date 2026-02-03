const { dbOutput } = require("../../../models/index");
const TmsUsers = dbOutput.tmsUsers;
const UamToolDetails = dbOutput.uamToolDetails;
const UamToolUsers = dbOutput.uamToolUsers;
const UamUserGroups = dbOutput.uamUserGroups;

exports.createTool = async (req, res) => {
  try {
    var { toolsArray, updatedBy } = req.body;

    if (toolsArray === null) {
      return res
        .status(400)
        .json({ success: false, message: "Please fill all the details" });
    }

    for (var i = 0; i < toolsArray.length; i++) {
      const tool = toolsArray[i];
      if (tool.name == null || tool.description == null) {
        return res
          .status(400)
          .json({ success: false, message: "Please fill all the details" });
      }
      const newTool = await UamToolDetails.create({
        name: tool.name,
        description: tool.description,
        link: tool.link,
        updatedBy: updatedBy === "" ? null : updatedBy,
      });

      // also adding the user id and tool id with the tool admin access type into the UamToolUsers table as we are giving tool admin permission to the user
      if (tool.adminId !== null) {
        const taUserGroup = await UamUserGroups.findOne({ where: { isDeleted: false, role: "Tool Admin" } })
        await UamToolUsers.create({ userId: tool.adminId, toolId: newTool.toolId, userGroupId: taUserGroup.id })
        // Check if the user is already a tool admin or not, if not then change their user type to 500
        const toolAdmin = await TmsUsers.findOne({
          where: { userId: tool.adminId , isDeleted: false}
        })

        if (toolAdmin.userType !== 500 && toolAdmin.userType !== 900) {
          await TmsUsers.update(
            { userType: 500 },
            { where: { userId: tool.adminId } }
          );
        }
      }
    }
    return res
      .status(201)
      .json({ success: true, message: "Tool added to UAM succesfully" });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

exports.getAllToolDetails = async (req, res) => {

  try {
    const tools = await UamToolDetails.findAll({
      where: {
        isDeleted: false,
      },
    });
    if (!tools) {
      return res.status(404).json({ success: false, message: "User does not exist" });
    }
    return res.status(201).json({ success: true, tools, message: "Tools fetched successfully" });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

exports.getAllToolAdmintools = async (req, res) => {
  const tid = req.params.tid
  try {
    const toolAdminId = await UamUserGroups.findOne({
      where: {
        role: "Tool Admin",
        isDeleted: false
      }
    })
    const tools = await UamToolUsers.findAll({
      where: {
        userId: tid,
        userGroupId:toolAdminId.id
      },
      include:[
        {
          model:UamToolDetails,
          as:"tool",
          attributes:["toolId", "name", "toolId"]
        }
      ]
      
    })
    const toolDataArray = tools.map(tool => tool.tool);
    if (!tools) {
      return res
        .status(404)
        .json({ success: false, message: "User does not exist" });
    }
    return res
      .status(201)
      .json({ success: true, tools:toolDataArray, message: "Tools fetched successfully" });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateUamTools = async (req, res) => {
  try {
    const { updatedToolDetails, updatedBy } = req.body;

    // var { toolId ,name, description, adminId, remark, link, startDate, endDate, updatedBy } The array object should contain this info
    if (updatedToolDetails == null) {
      return res
        .status(400)
        .json({ success: false, message: "Please fill all the details" });
    }
    for (var i = 0; i < updatedToolDetails.length; i++) {
      const uamTool = updatedToolDetails[i];
      if (
        (uamTool.toolId == null ||
          uamTool.name == null ||
          uamTool.description == null,
          uamTool.link == null || updatedBy == null)
      ) {
        return res.status(400).json({
          success: false,
          message: `Please fill all the details for tool ${i + 1}`,
        });
      }
      await UamToolDetails.update(
        {
          name: uamTool.name,
          description: uamTool.description,
          remark: uamTool.remark,
          link: uamTool.link,
          updatedBy: updatedBy === "" ? null : updatedBy,
        },
        {
          where: { toolId: uamTool.toolId },
        }
      );

      if (uamTool.adminId !== null) {
        const taUserGroup = await UamUserGroups.findOne({ where: { isDeleted: false, role: "Tool Admin" } })
        // this is modified to support only one tool admin for a specific tool but in future we will make the change to support multiple tool admins after getting complete requirements

        await UamToolUsers.update({ userId: uamTool.adminId }, {
          where: {
            toolId: uamTool.toolId, userGroupId: taUserGroup.id
          }
        })

        // Check if the user is already a tool admin or not, if not then change their user type to 500
        const toolAdmin = await TmsUsers.findOne({
          where: { userId: tool.adminId, isDeleted: false }
        })

        if (toolAdmin.userType !== 500 && toolAdmin.userType !== 900) {
          await TmsUsers.update(
            { userType: 500 },
            { where: { userId: uamTool.adminId } }
          );
        }

      }
    }



    return res
      .status(201)
      .json({ success: true, message: "UAM tools updated successfully" });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};



exports.deleteToolById = async (req, res) => {
  try {
    const { toolIds } = req.body;
    if (toolIds == null) {
      return res.status(400).json({
        success: false,
        message: "Please provide the tool details to delete the tool",
      });
    }
    for (var i = 0; i < toolIds.length; i++) {
      await UamToolDetails.update(
        {
          isDeleted: true,
        },
        {
          where: { toolId: toolIds[i] },
        }
      );

    }

    return res
      .status(201)
      .json({ success: true, message: "Tool deleted from UAM succesfully" });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};
