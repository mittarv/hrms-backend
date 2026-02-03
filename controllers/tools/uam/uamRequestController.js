// const { Op } = require("sequelize");
const { dbOutput } = require("../../../models/index");
const UamRequest = dbOutput.uamRequest;
const UamToolUsers = dbOutput.uamToolUsers;
const UserGroup = dbOutput.uamUserGroups;
const TmsUsers = dbOutput.tmsUsers
const UamToolDetails = dbOutput.uamToolDetails;
exports.createRequest = async (req, res) => {
  try {
    const {
      toolId,
      requestedBy,
      //   requestedOn,
      requestedAccess,
      currentAccess,
      remark,
      //   status,
      //   resolvedOn,
      //   resolvedBy,
    } = req.body;
    if (
      !toolId ||
      !requestedBy ||
      !requestedAccess ||
      !currentAccess ||
      !remark
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Please fill all the details" });
    }
    const request = await UamRequest.create({
      toolId,
      requestedBy,
      requestedAccess,
      currentAccess,
      status: "pending",
      remark,
    });
    // var {
    //   toolId,
    //   userId,
    //   remark,
    //   newUserGroupId,
    //   status,
    //   startDate,
    //   endDate,
    //   updatedBy,
    // } = req.body;
    // if (
    //   toolId == null ||
    //   userId == null ||
    //   remark == null ||
    //   newUserGroupId == null ||
    //   status == null ||
    //   updatedBy == null ||
    //   startDate == null
    // ) {
    //   return res
    //     .status(400)
    //     .json({ success: false, message: "Please fill all the details" });
    // }
    // const request = await UamRequest.create({
    //   toolId,
    //   userId,
    //   remark,
    //   newUserGroupId,
    //   status,
    //   startDate,
    //   endDate,
    //   updatedBy,
    // });
    return res
      .status(201)
      .json({ success: true, request, message: "Request sent successfully" });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

exports.getAllRequests = async (req, res) => {
  try {
    const requests = await UamRequest.findAll({
      where: { isDeleted: false },

      include: [
        {
          model: dbOutput.uamToolDetails,
          as: "tool",
          attributes: ["name", "description"],
        },
        {
          model: dbOutput.tmsUsers,
          as: "requestedByUser",
          attributes: ["userId", "name", "email"],
        },

        {
          model: dbOutput.tmsUsers,
          as: "resolvedByUser",
          attributes: ["userId", "name", "email"],
        },
        {
          model: dbOutput.uamUserGroups,
          as: "currentAccessGroup",
          attributes: ["role", "id", "value"],
        },
        {
          model: dbOutput.uamUserGroups,
          as: "requestedAccessGroup",
          attributes: ["role", "id", "value"],
        },
      ],
    });
    if (!requests) {
      return res
        .status(404)
        .json({ success: false, message: "There are no requests currently" });
    }
    return res.status(201).json({
      success: true,
      requests,
      message: "Requests fetched successfully",
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

exports.getRequestById = async (req, res) => {
  try {
    const id = req.params.id;
    const request = await UamRequest.findOne({ where: { id } });
    if (!request) {
      return res
        .status(404)
        .json({ success: false, message: "There is no such request" });
    }
    return res.status(201).json({
      success: true,
      request,
      message: "Request fetched successfully",
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

exports.getRequestByUserId = async (req, res) => {
  try {
    const id = req.params.id;
    const requests = await UamRequest.findAll({
      where: { requestedBy: id, status: "pending" },
      include: [
        {
          model: dbOutput.uamUserGroups,
          as: "requestedAccessGroup",
          attributes: ["role", "id", "value"],
        },
      ],
    }); //it will exclude all the approved requests
    if (!requests) {
      return res
        .status(404)
        .json({ success: false, message: "There are no requests currently" });
    }
    return res.status(201).json({
      success: true,
      requests,
      message: "Requests fetched successfully",
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// function for changing the status of the request based on the action flow by the super admin
exports.changRequestStatus = async (req, res) => {
  try {
    const id = req.params.id;
    //here the status will be approved or rejected and need to passed from the front end in small case
    //adding two new fields requestedBy and toolId,
    // adding requestedBy to update the userStatus if the accessType is ToolAdmin
    // adding toolId to update the userGroup in the uamToolUsers table
    //adding requestedAccess to check if the accessType is ToolAdmin or not?
    const { status, resolvedBy } = req.body;

    if (!id || !status || !resolvedBy) {
      return res
        .status(400)
        .json({ success: false, message: "Please fill all the details" });
    }
    const request = await UamRequest.findOne({ where: { id } });
    if (!request) {
      return res
        .status(404)
        .json({ success: false, message: "There is no such request" });
    }

    //if the status is approved, only then we need to update the userType and userGroup
    if (status.includes("approved")) {

      const userGroup = await UserGroup.findOne({
        where: { id: request.requestedAccess },
      });

      if (!userGroup) {
        return res
          .status(404)
          .json({ success: false, message: "There is no such userGroup" });
      }

      const findIfExistsAnyPermission = await UamToolUsers.findOne({
        where: {
          userId: request.requestedBy, toolId: request.toolId
        }
      })

      if (!findIfExistsAnyPermission) {
        await UamToolUsers.create({ userId: request.requestedBy, toolId: request.toolId, userGroupId: request.requestedAccess, updatedBy: resolvedBy });

      } else {
        await UamToolUsers.update(
          { userGroupId: request.requestedAccess },
          { where: { userId: request.requestedBy, toolId: request.toolId } }
        );
      }

      // Now check if the user has any tool admin access
      const toolAdminId = await UserGroup.findOne({
        where: {
          role: "Tool Admin",
          isDeleted: false
        }
      })

      const allToolUserTools = await UamToolUsers.findAll({
        where: {
          userId: request.requestedBy,
          userGroupId: toolAdminId.id

        }
      })

      //FETCH the user type to check if he is a super admin, in this case we won't change the user type to tool admin --- (EDGE CASE)
      // WHY EDGE CASE - The request access page is usually not visible to Super admins but to avoid any api call related issues it's considerable
      const requestedByUser = await dbOutput.tmsUsers.findOne({ where: { userId: request.requestedBy, isDeleted: false } });
      //Also adding the "requestedByUser.userType !== 500" condition as if the user is already a tool admin there's no need to update it again.
      if (requestedByUser.userType !== 900 && requestedByUser.userType !== 500) {
        if (
          userGroup.role.includes("Tool Admin") ||
          userGroup.role.includes("tool Admin")
        ) {


          await dbOutput.tmsUsers.update(
            { userType: 500 },
            { where: { userId: request.requestedBy } }
          );

        }
      }

      await UamRequest.update(
        {
          status: "approved",
          resolvedBy: resolvedBy === "" ? null : resolvedBy,
          resolvedOn: new Date(),
          currentAccess: request.requestedAccess,
        },
        {
          where: { id },
        }
      );

      if (allToolUserTools.length <= 0) {
        // Now change the userType to 100
        await TmsUsers.update(
          { userType: 100 },
          { where: { userId: request.requestedBy } }
        );
      }


      return res.status(200).json({
        success: true,
        message: "Request approved successfully",
      });

    }
    else {
      await UamRequest.update(
        {
          status: "rejected",
          resolvedBy: resolvedBy === "" ? null : resolvedBy,
          isDeleted: true,
          resolvedOn: new Date(),
          requestedAccess: request.currentAccess,
        },
        {
          where: { id },
        }
      );
      return res.status(200).json({
        success: true,
        message: "Request rejected successfully",
      });
    }
    // if (status == "approved") {
    //   const updatedRequest = await UamRequest.update(
    //     { status },
    //     {
    //       where: { id },
    //     }
    //   );
    //   res
    //     .status(200)
    //     .json({ success: true, updatedRequest, message: "Request approved" });
    // } else if (status == "rejected") {
    //   await UamRequest.destroy({
    //     where: { id },
    //   });
    //   return res
    //     .status(201)
    //     .json({ success: true, tool, message: "Request rejected" });
    // }
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

exports.getAllActivityLogs = async (_, res) => {
  try {
    const activityLogs = await UamRequest.findAll({
      include: [
        {
          model: dbOutput.uamToolDetails,
          as: "tool",
          attributes: ["name", "description"],
        },
        {
          model: dbOutput.tmsUsers,
          as: "requestedByUser",
          attributes: ["userId", "name", "email"],
        },

        {
          model: dbOutput.tmsUsers,
          as: "resolvedByUser",
          attributes: ["userId", "name", "email"],
        },
        {
          model: dbOutput.uamUserGroups,
          as: "currentAccessGroup",
          attributes: ["role", "id", "value"],
        },
        {
          model: dbOutput.uamUserGroups,
          as: "requestedAccessGroup",
          attributes: ["role", "id", "value"],
        },
      ],
      order: [['updatedAt', 'DESC']]
    });
    if (!activityLogs) {
      return res.status(404).json({
        success: false,
        message: "There are no activity logs currently",
      });
    }
    return res.status(201).json({
      success: true,
      activityLogs,
      message: "Activity logs fetched successfully",
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};
