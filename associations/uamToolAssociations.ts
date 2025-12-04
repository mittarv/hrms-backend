import { db } from "../models/index";

export const setUamAssociations = (): void => {

    //One to one
    db.uamToolDetails.belongsTo(db.tmsUsers, {
        foreignKey: "adminId",
        as: "admin",
        constraints: true,
        constraintName: "fk_uamToolDetails_tmsUsers_adminId"
    });

    //One to one
    db.uamToolUsers.belongsTo(db.uamUserGroups, {
        foreignKey: "userGroupId",
        as: "userGroup",
        constraints: true,
        constraintName: "fk_uamToolUsers_uamUserGroups_userGroupId"
    });

    //One to one
    db.uamToolUsers.belongsTo(db.uamToolDetails, {
        foreignKey: "toolId",
        as: "tool",
        constraints: true,
        constraintName: "fk_uamToolUsers_uamToolDetails_toolId"
    });

    //One to one
    db.uamRequest.belongsTo(db.uamUserGroups, {
        foreignKey: "newUserGroupId",
        as: "userGroup",
        constraints: true,
        constraintName: "fk_uamRequest_uamUserGroups_newUserGroupId"
    });

    //One to one
    db.uamRequest.belongsTo(db.tmsUsers, {
        foreignKey: "requestedBy",
        as: "requestedByUser",
        constraints: true,
        constraintName: "fk_uamRequest_tmsUsers_requestedBy"
    });

    //One to one
    db.uamRequest.belongsTo(db.tmsUsers, {
        foreignKey: "resolvedBy",
        as: "resolvedByUser",
        constraints: true,
        constraintName: "fk_uamRequest_tmsUsers_resolvedBy"
    });

    //One to one
    db.uamRequest.belongsTo(db.uamToolDetails, {
        foreignKey: "toolId",
        as: "tool",
        constraints: true,
        constraintName: "fk_uamRequest_uamToolDetails_toolId"
    });

    //One to one
    db.uamRequest.belongsTo(db.uamUserGroups, {
        foreignKey: "currentAccess",
        as: "currentAccessGroup",
        constraints: true,
        constraintName: "fk_uamRequest_uamUserGroups_currentAccess"
    })

    //One to one
    db.uamRequest.belongsTo(db.uamUserGroups, {
        foreignKey: "requestedAccess",
        as: "requestedAccessGroup",
        constraints: true,
        constraintName: "fk_uamRequest_uamUserGroups_requestedAccess"
    })

    // HR Repository associations
    //One to one - Policy List creator
    db.policyList.belongsTo(db.tmsUsers, {
        foreignKey: "createdBy",
        as: "creator",
        constraints: false
    });

    //One to one - Policy List modifier
    db.policyList.belongsTo(db.tmsUsers, {
        foreignKey: "lastModifiedBy",
        as: "modifier",
        constraints: false
    });

    //One to one - Important Link List creator
    db.importantLinkList.belongsTo(db.tmsUsers, {
        foreignKey: "createdBy",
        as: "creator",
        constraints: false
    });

    //One to one - Important Link List modifier
    db.importantLinkList.belongsTo(db.tmsUsers, {
        foreignKey: "lastModifiedBy",
        as: "modifier",
        constraints: false
    });
}