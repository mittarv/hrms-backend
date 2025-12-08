const { dbOutput } = require("../../../models/index");
const { sequelize } = dbOutput;
const ImportantLinkList = dbOutput.importantLinkList;
const PolicyList = dbOutput.policyList;
const TmsUser = dbOutput.tmsUsers;
import { createHRMSNotification } from "../../../utilities/hrmsUtilities/dbCalls";
import { hrmsNotificationTypes } from "../../../interfaces/hrmsTool/enum/hrmsEnum";
//===================fetching all the important links from the database and this function will be same for the every user=========================,
//=============================================I mean super admin and normal admin============================================================================
exports.getImportantLinkList = async (_, res) => {
  try {
    const importantLinkList = await ImportantLinkList.findAll({
      where: { isDeleted: false },
      order: [["createdAt"]],
      include: [
        {
          model: TmsUser,
          as: "creator",
          attributes: ["name"],
        },
        {
          model: TmsUser,
          as: "modifier",
          attributes: ["name"],
        },
      ],
    });
    return res.status(200).send({
      success: true,
      message: "Important Link List",
      importantLinkList,
    });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

//===================fetching all the policy from the database and this function will be same for the every user=========================,
exports.getPolicyList = async (_, res) => {
  try {
    const policyList = await PolicyList.findAll({
      where: { isDeleted: false },
      order: [["createdAt"]],
      include: [
        {
          model: TmsUser,
          as: "creator",
          attributes: ["name"],
        },
        {
          model: TmsUser,
          as: "modifier",
          attributes: ["name"],
        },
      ],
    });
    console.log(policyList)
    return res.status(200).send({
      success: true,
      message: "Policy List",
      policyList,
    });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

//===================adding a new policy to the database and this function will be available only for super admin=========================,
exports.addImportantLink = async (req, res) => {
  let transaction;
  try {
    const { toolArray, lastModifiedBy, createdBy, employeeUuid } = req.body;
    transaction = await sequelize.transaction();

    const allNotificationResults = [];

    for (let i = 0; i < toolArray.length; i++) {
      const tool = toolArray[i];
      const { toolName, toolLink } = tool;

      if (!toolName || !toolLink || !lastModifiedBy || !createdBy) {
        await transaction.rollback();
        return res
          .status(400)
          .send({ success: false, message: "Please provide all the details" });
      }

      const ifExists = await ImportantLinkList.findOne({
        where: { toolName, isDeleted: false },
        transaction
      });

      if (ifExists) {
        await transaction.rollback();
        return res
          .status(400)
          .send({ success: false, message: "You Can't use the same name" });
      }

      await ImportantLinkList.create(
        { toolName, toolLink, lastModifiedBy, createdBy },
        { transaction }
      );

      const message = JSON.stringify({
        prefix: "A New Important Link",
        linkText: `${toolName}`,
        linkUrl: "/imp-link",
        suffix: `has been added by an admin.`
      });

      const notificationResponse = await createHRMSNotification(
        {
          notification_type: hrmsNotificationTypes.ORGANIZATION_UPDATES,
          message: message,
          sender_employee_id: employeeUuid || "admin",
        }
        // No transaction passed since it's in a different database
      );

      // You can collect these if needed in the response
      allNotificationResults.push(notificationResponse);
    }

    await transaction.commit();
    return res.status(201).send({
      success: true,
      message: "New Important Link(s) Added and Notification Sent to employees.",
      notifications: allNotificationResults
    });

  } catch (error) {
    if (transaction) await transaction.rollback();
    return res.status(500).send({
      success: false,
      message: "Failed to add link or send notification",
      error: error?.message || error,
    });
  }
};


//===================adding a new policy to the database and this function will be available only for super admin=========================,

exports.addPolicy = async (req, res) => {
  let transaction;
  try {
    //=============here the last modified by and created by will be the user id of the super admin or who is adding the policy===================
    const { policyArray, createdBy, lastModifiedBy, employeeUuid } = req.body;
    transaction = await sequelize.transaction();

    const allNotificationResults = [];

    for (let i = 0; i < policyArray.length; i++) {
      const policy = policyArray[i];
      const { policyName, policyLink, version, remarks, approvedBy } = policy;

      if (
        !policyName ||
        !policyLink ||
        !lastModifiedBy ||
        !createdBy ||
        !version ||
        !remarks ||
        !approvedBy
      ) {
        await transaction.rollback();
        return res
          .status(400)
          .send({ success: false, message: "Please provide all the details" });
      }

      const ifExists = await PolicyList.findOne({
        where: { policyName, isDeleted: false },
        transaction
      });

      if (ifExists) {
        await transaction.rollback();
        return res
          .status(400)
          .send({ success: false, message: "You Can't use the same policy name" });
      }

      await PolicyList.create(
        {
          policyName,
          policyLink,
          lastModifiedBy,
          createdBy,
          version,
          remarks,
          approvedBy,
        },
        { transaction }
      );

      const message = JSON.stringify({
        prefix: "A New Policy",
        linkText: `${policyName}`,
        linkUrl: "/policies",
        suffix:  `has been added by an admin.`
      });

      const notificationResponse = await createHRMSNotification(
        {
          notification_type: hrmsNotificationTypes.ORGANIZATION_UPDATES,
          message: message,
          sender_employee_id: employeeUuid || "admin",
        }
        // No transaction passed since it's in a different database
      );

      // You can collect these if needed in the response
      allNotificationResults.push(notificationResponse);
    }

    await transaction.commit();
    return res.status(201).send({
      success: true,
      message: "New Policy(s) Added and Notification Sent to employees.",
      notifications: allNotificationResults
    });

  } catch (error) {
    if (transaction) await transaction.rollback();
    return res.status(500).send({
      success: false,
      message: "Failed to add policy or send notification",
      error: error?.message || error,
    });
  }
};

//===================updating a policy to the database and this function will be available only for super admin=========================,
exports.updatePolicy = async (req, res) => {
  try {
    const { policyArray, lastModifiedBy } = req.body;
    for (var i = 0; i < policyArray.length; i++) {
      const policy = policyArray[i];

      await PolicyList.update(
        {
          policyName: policy.policyName,
          policyLink: policy.policyLink,
          lastModifiedBy: lastModifiedBy,
          version: policy.version,
          remarks: policy.remarks,
          approvedBy: policy.approvedBy,
        },
        {
          where: {
            id: policyArray[i]["id"],
          },
        }
      );
    }
    return res.status(201).send({ success: true, message: "Policy Updated" });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

//===================updating a important link to the database and this function will be available only for super admin=========================,
exports.updateImportantLink = async (req, res) => {
  try {
    const { toolArray, lastModifiedBy } = req.body;
    for (var i = 0; i < toolArray.length; i++) {
      const tool = toolArray[i];
      const { toolName, toolLink } = tool;

      if (
        toolName === null ||
        toolName === undefined ||
        toolLink === null ||
        toolLink === undefined ||
        lastModifiedBy === null ||
        lastModifiedBy === undefined
      ) {
        return res
          .status(400)
          .send({ success: false, message: "Please provide all the details" });
      }
      //removing the checks from update api.
      await ImportantLinkList.update(
        { toolName, toolLink, lastModifiedBy },
        { where: { id: toolArray[i]["id"] } }
      );
    }
    return res
      .status(201)
      .send({ success: true, message: "Important Link Updated" });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

//==============================deleting the policy from the database and this function will be available only for super admin=========================
exports.deletePolicy = async (req, res) => {
  try {
    const { id } = req.body;
    if (!id || id === undefined) {
      return res
        .status(400)
        .send({ success: false, message: "Please provide the id" });
    }
    await PolicyList.update({ isDeleted: true }, { where: { id } });
    return res.status(200).send({ success: true, message: "Policy Deleted" });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};
//==============================deleting the important link from the database and this function will be available only for super admin=========================
exports.deleteImportantLink = async (req, res) => {
  try {
    const { id } = req.body;
    if (!id || id === undefined) {
      return res
        .status(400)
        .send({ success: false, message: "Please provide the id" });
    }
    await ImportantLinkList.update({ isDeleted: true }, { where: { id } });
    return res
      .status(200)
      .send({ success: true, message: "Important Link Deleted" });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};
