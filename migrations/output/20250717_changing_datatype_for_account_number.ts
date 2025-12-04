'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.changeColumn('employeebankaccountdetailhistories', 'empAccountNumber', {
            type: Sequelize.STRING(30),
            comment: 'Employee account number with leading zero support'
        });

        await queryInterface.changeColumn('employeebankaccountdetails', 'empAccountNumber', {
            type: Sequelize.STRING(30),
            comment: 'Employee account number with leading zero support'
        });
    },

    down: async (queryInterface, Sequelize) => {
        // Fixed: Use correct column name 'empAccountNumber' instead of 'accountNumber'
        await queryInterface.changeColumn('employeebankaccountdetailhistories', 'empAccountNumber', {
            type: Sequelize.BIGINT
        });

        await queryInterface.changeColumn('employeebankaccountdetails', 'empAccountNumber', {
            type: Sequelize.BIGINT,
        });
    }
};