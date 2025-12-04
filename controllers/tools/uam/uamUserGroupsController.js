const {db,} = require('../../../models/index');
const UamUserGroups = db.uamUserGroups

exports.createNewUserGroup = async (req, res) => {
    try {
        var { userGroupsList } = req.body;
        // var { role, view, modify, validate, approve, updatedBy } = req.body;                                
        const groups = [];
        if (userGroupsList == null) {
            return res.status(400).json({ success: false, message: "Please add atleast one user group" });
        }
        for (var i = 0; i < userGroupsList.length; i++) {
            var userGroup = userGroupsList[i]
            const group = await UamUserGroups.create(userGroup);
            groups.push(group);
        }
        return res.status(201).json({ success: true, groups, message: "User groups added to UAM tool succesfully" });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
}

exports.getAllUserGroups = async (req, res) => {
    try {
        const groups = await UamUserGroups.findAll({
            where: { isDeleted: false },
        });
        if (!groups) {
            return res.status(404).json({ success: false, message: "Any user group does not exist" });
        }
        return res.status(201).json({ success: true, groups, message: "User Groups fetched successfully" });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
}

exports.updateUserGroupById = async (req, res) => {
    try {
        const { updatedUserGroups, userId } = req.body;
        for (var i = 0; i < updatedUserGroups.length; i++) {
            const userGroup = updatedUserGroups[i];
            await UamUserGroups.update({ role: userGroup['role'], view: userGroup['view'], modify: userGroup['modify'], approver: userGroup['approver'], addmembers: userGroup['addmembers'], updatedBy: userId }, { where: { id: userGroup['id'] } });
        }
        return res.status(201).json({ success: true, message: "User Groups updated successfully" });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
}

exports.deleteUserGroupsByIds = async (req, res) => {
    try {
        // request structure : userGroupIds:[group ids]
        const { userGroupIds } = req.body;
        if (userGroupIds == null) {
            return res.status(400).json({ success: false, message: "Please provide the tool details to delete the tool" });
        }
        for(var i=0;i<userGroupIds.length;i++){
            const userGroupId = userGroupIds[i];
            await UamUserGroups.update({ isDeleted: true }, { where: { id: userGroupId } });
            // await UamUserGroups.update({ where: { id: userGroupId } });

        }
        return res.status(201).json({ success: true, message: "User Groups deleted successfully" });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
}