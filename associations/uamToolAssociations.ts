import { dbOutput } from "../models/index";

export const setUamAssociations = (): void => {

    //One to one
    dbOutput.uamToolDetails.belongsTo(dbOutput.tmsUsers, {
        foreignKey: "adminId",
        as: "admin",
        constraints: true,
        constraintName: "fk_uamToolDetails_tmsUsers_adminId"
    });

    //One to one
    dbOutput.uamToolUsers.belongsTo(dbOutput.uamUserGroups, {
        foreignKey: "userGroupId",
        as: "userGroup",
        constraints: true,
        constraintName: "fk_uamToolUsers_uamUserGroups_userGroupId"
    });

    //One to one
    dbOutput.uamToolUsers.belongsTo(dbOutput.uamToolDetails, {
        foreignKey: "toolId",
        as: "tool",
        constraints: true,
        constraintName: "fk_uamToolUsers_uamToolDetails_toolId"
    });

    //One to one
    dbOutput.uamRequest.belongsTo(dbOutput.uamUserGroups, {
        foreignKey: "newUserGroupId",
        as: "userGroup",
        constraints: true,
        constraintName: "fk_uamRequest_uamUserGroups_newUserGroupId"
    });

    //One to one
    dbOutput.uamRequest.belongsTo(dbOutput.tmsUsers, {
        foreignKey: "requestedBy",
        as: "requestedByUser",
        constraints: true,
        constraintName: "fk_uamRequest_tmsUsers_requestedBy"
    });

    //One to one
    dbOutput.uamRequest.belongsTo(dbOutput.tmsUsers, {
        foreignKey: "resolvedBy",
        as: "resolvedByUser",
        constraints: true,
        constraintName: "fk_uamRequest_tmsUsers_resolvedBy"
    });

    //One to one
    dbOutput.uamRequest.belongsTo(dbOutput.uamToolDetails, {
        foreignKey: "toolId",
        as: "tool",
        constraints: true,
        constraintName: "fk_uamRequest_uamToolDetails_toolId"
    });

    //One to one
    dbOutput.uamRequest.belongsTo(dbOutput.uamUserGroups, {
        foreignKey: "currentAccess",
        as: "currentAccessGroup",
        constraints: true,
        constraintName: "fk_uamRequest_uamUserGroups_currentAccess"
    })

    //One to one
    dbOutput.uamRequest.belongsTo(dbOutput.uamUserGroups, {
        foreignKey: "requestedAccess",
        as: "requestedAccessGroup",
        constraints: true,
        constraintName: "fk_uamRequest_uamUserGroups_requestedAccess"
    })
}