const { dbOutput } = require('../../../models/index');
const UamToolUsers = dbOutput.uamToolUsers
const UamUserGroups = dbOutput.uamUserGroups;
const Tmsusers = dbOutput.tmsUsers;
const UamToolDetails = dbOutput.uamToolDetails;
const { Op } = require('sequelize');

//This API will be use to add users to all the tools. Pass an array because multiple users can also be added in different tools at the same time
// the array should be like : toolUserGroupList = [{'toolId':1,'userGroupId':1000},{'toolId':2,'userGroupId':2000}]
exports.addUserToTool = async (req, res) => {
    try {
        var { toolUserGroupList, updatedBy } = req.body;

        if (toolUserGroupList == null || updatedBy == null) {
            return res.status(400).json({ success: false, message: "Please fill all the details" });
        }
        for (var i = 0; i < toolUserGroupList.length; i++) {
            const userTool = toolUserGroupList[i]
            // check if any entry present with the same userId and toolId, In that case we will update it
            let checkEntry = await UamToolUsers.findOne({
                where: {
                    userId: userTool.userId,
                    toolId: userTool.toolId
                }
            })
            if (!checkEntry) {
                await UamToolUsers.create({ userId: userTool.userId, toolId: userTool.toolId, userGroupId: userTool.userGroupId, updatedBy });
            } else {
                await UamToolUsers.update({ userGroupId: userTool.userGroupId }, { where: { userId: userTool.userId, toolId: userTool.toolId } });
            }

            // fetching the data of the user group as we also need to make changes if the user group id belongs to the tool admin permission
            const taUserGroup = await UamUserGroups.findOne({ where: { isDeleted: false, id: userTool.userGroupId } })
            if (taUserGroup.role === "Tool Admin") {

                // Check if the user is already a tool admin or not, if not then change their user type to 500
                const toolAdmin = await Tmsusers.findOne({
                    where: { userId: userTool.userId }
                })

                if (toolAdmin.userType !== 500 && toolAdmin.userType !== 900) {
                    await Tmsusers.update(
                        { userType: 500 },
                        { where: { userId: userTool.userId } }
                    );
                }
            } else {
                // Now check if the user has a tool admin user type but he does't have any tool admin access for any tools. In that case we will change their user type. 
                const toolAdmin = await Tmsusers.findOne({
                    where: { userId: userTool.userId }
                })
                if (toolAdmin.userType === 500) {
                    // Get the id for the tool admin access
                    const toolAdminId = await UamUserGroups.findOne({
                        where: {
                            role: "Tool Admin",
                            isDeleted: false
                        }
                    })
                    const allToolUserTools = await UamToolUsers.findAll({
                        where: {
                            userId: userTool.userId,
                            userGroupId: toolAdminId.id

                        }
                    })

                    if (allToolUserTools.length <= 0) {
                        // Now change the userType to 100
                        await Tmsusers.update(
                            { userType: 100 },
                            { where: { userId: userTool.userId } }
                        );
                    }
                }
            }
        }
        return res.status(201).json({ success: true, message: "User added to UAM Tool succesfully" });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
}


// This API will be used to get all users along with all the tools in which they are added
exports.getAllToolUsersWithTools = async (req, res) => {
    try {
        const tmsUsers = await Tmsusers.findAll({
            attributes: ["userId", "name", "email"],
            where: {
                isDeleted: false,
                userType: {
                    [Op.ne]: 900 // Not equal to 900
                }
            }
        });
        if (!tmsUsers) {
            return res.status(400).json({ success: false, message: "No users found" });
        }
        const userTools = [];
        for (var i = 0; i < tmsUsers.length; i++) {
            const user = tmsUsers[i];
            const tools = await UamToolUsers.findAll({
                where: { userId: user.userId }, attributes: [], include: [
                    {
                        model: UamUserGroups,
                        as: "userGroup",
                        attributes: ["role", "value", 'id'],
                    },
                    {
                        model: UamToolDetails,
                        as: "tool",
                        attributes: ["toolId", "name", 'toolId'],
                    }
                ]
            });
            if (tools) {
                userTools.push({ user, tools });
            }
        }
        return res.status(201).json({ success: true, userTools, message: "UAM tools with Users fetched successfully" });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
}

// This API will be used to fetch all the users associated with a particular tool by toolId
exports.getAllToolUsersByToolId = async (req, res) => {
    try {
        const toolId = req.params.id;
        const toolUsers = await UamToolUsers.findAll({
            where: { toolId }, attributes: ["userId", "userGroupId",], include: [
                {
                    model: UamUserGroups,
                    as: "userGroup",
                    attributes: ["role", "value"],
                }
            ]
        });
        if (!toolUsers) {
            return res.status(404).json({ success: false, message: "User does not exist" });
        }
        return res.status(201).json({ success: true, toolUsers, message: "Tools fetched successfully" });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
}


// This API will be used to fetch all the tools associated with a paricular user by userId
exports.getAllToolDetailsByUserId = async (req, res) => {
    try {
        const userId = req.params.id;
        const userTools = await UamToolUsers.findAll({
            where: { userId },
            attributes: [],
            include: [
                {
                    model: UamToolDetails,
                    as: "tool",
                    attributes: ["toolId", "name", 'description'],
                },

                {
                    model: UamUserGroups,
                    as: "userGroup",
                    attributes: ["id", "role", "value"],
                }
            ]
        });

        let idPresent = userTools.map((tool) => tool.tool.toolId)
        
        const tools = await UamToolDetails.findAll({
            where: {
                toolId: {
                    [dbOutput.Sequelize.Op.notIn]: idPresent
                },
                isDeleted: false
            },
            attributes: ['toolId', 'name', "description"]
        });
        const userGroups = await UamUserGroups.findOne({
            where: {
                role: 'No Access'
            },
            attributes: ['id', 'role', "value"]
        });
        const plainTools = tools?.map(tool => tool?.get({ plain: true }));
        const plainUserGroup = userGroups?.get({ plain: true });
        const combineResult = plainTools?.map((tool) => {
            return {
                tool: tool,
                userGroup: plainUserGroup
            }
        })

        if (!userTools) {
            return res.status(404).json({ success: false, message: "You are not added to any Mitt Arv tools" });
        }
        return res.status(201).json({ success: true, userTools , othertools:combineResult, message: "User tools fetched successfully" });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
}

// This API will be used to update the access of users to a singll/multiple tools. Also multiple users can be u[pdated at the same time so we need to pass an array of users along with an object having toolId and the old/new userGroup type.

exports.updateToolUserGroup = async (req, res) => {
    try {
        const { userToolsList } = req.body;
        // It should be in the form : userToolList = [{'user': [{'userId':2700,'userGroupId':4,toolId:2}],{'user': [{'userId':2701,'userGroupId':1,toolId:2}]}]
        for (var i = 0; i < userToolsList.length; i++) {
            const user = userToolsList[i];
            if (user['userGroupId'] == null || user['toolId'] == null) {
                return res.status(404).json({ success: false, message: "Please provide correct details" });
            }
            await UamToolUsers.update({ userGroupId: user['userGroupId'] }, { where: { userId: user['userId'], toolId: user['toolId'] } });

            const taUserGroup = await UamUserGroups.findOne({ where: { isDeleted: false, id: user['userGroupId'] } })

            if (taUserGroup.role === "Tool Admin") {
                // Check if the user is already a tool admin or not, if not then change their user type to 500
                const toolAdmin = await Tmsusers.findOne({
                    where: { userId: user['userId'] }
                })

                if (toolAdmin.userType !== 500 && toolAdmin.userType !== 900) {
                    await Tmsusers.update(
                        { userType: 500 },
                        { where: { userId: user['userId'] } }
                    );
                }
            } else {
                // Now check if the user has a tool admin user type but he does't have any tool admin access for any tools. In that case we will change their user type. 
                const toolAdmin = await Tmsusers.findOne({
                    where: { userId: user['userId'] }
                })

                if (toolAdmin.userType === 500) {
                    // Get the id for the tool admin access
                    const toolAdminId = await UamUserGroups.findOne({
                        where: {
                            role: "Tool Admin",
                            isDeleted: false
                        }
                    })
                    const allToolUserTools = await UamToolUsers.findAll({
                        where: {
                            userId: user['userId'],
                            userGroupId: toolAdminId.id

                        }
                    })

                    if (allToolUserTools.length <= 0) {
                        // Now change the userType to 100
                        await Tmsusers.update(
                            { userType: 100 },
                            { where: { userId: user['userId'] } }
                        );
                    }
                }
            }
        }
        return res.status(201).json({ success: true, userToolsList, message: "User tool access updated successfully" });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
}


// This API will be used to remove users from all the tools in which previously they were added
exports.removeUserFromToolbyToolId = async (req, res) => {
    try {
        var { userIds } = req.body;
        if (userIds == null) {
            return res.status(400).json({ success: false, message: "Please provide user details" });
        }

        for (var i = 0; i < userIds.length; i++) {
            const userId = userIds[i];
            await UamToolUsers.destroy(
                {
                    where: { userId: userId },
                }
            );
            await Tmsusers.update(
                {
                    isDeleted: true,
                },
                {
                    where: { userId },
                });
        }
        return res.status(201).json({ success: true, message: "User removed from UAM tool successfully" });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
}