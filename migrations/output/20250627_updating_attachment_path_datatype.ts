'use strict';
module.exports = {
    up: async (queryInterface: any, Sequelize: any) => {
        console.log("Changing attachmentPath to LONGBLOB in employeeleaverequestdetails");
        
        await queryInterface.changeColumn("employeeleaverequestdetails", "attachmentPath", {
            type: Sequelize.BLOB('long'),
        });

        console.log("Changed attachmentPath to LONGBLOB in employeeleaverequestdetails");
    },

    down: async (queryInterface: any, Sequelize: any) => {
        console.log("Reverting attachmentPath from LONGBLOB in employeeleaverequestdetails");
        
        await queryInterface.changeColumn("employeeleaverequestdetails", "attachmentPath", {
            type: Sequelize.STRING,
        });

        console.log("Reverted attachmentPath to STRING in employeeleaverequestdetails");
    },
};