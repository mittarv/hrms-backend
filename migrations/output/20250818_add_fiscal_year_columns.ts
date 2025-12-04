'use strict';

import { DataTypes, QueryInterface } from "sequelize";
import { outputSequelize } from "../../models";

module.exports = {
  async up(queryInterface: QueryInterface): Promise<void> {
    console.log('Started migration: Updating fiscal year columns in employeeLeaveBalanceDetails table');

    try {
        await outputSequelize.transaction(async (transaction) => {
            await queryInterface.addColumn('employeeLeaveBalanceDetails', 'fiscalYearStart', {
                type: DataTypes.DATE,
                allowNull: true,
            }, { transaction });
            await queryInterface.addColumn('employeeLeaveBalanceDetails', 'fiscalYearEnd', {
                type: DataTypes.DATE,
                allowNull: true,
            }, { transaction });
        });
      
        console.log('Completed migration: Fiscal year columns updated in employeeLeaveBalanceDetails table');
    } catch(error) {
        console.log(error);
    }
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    console.log('Started rollback: Updating fiscal year columns in employeeLeaveBalanceDetails table');

    try {
        await outputSequelize.transaction(async (transaction) => {
            await queryInterface.removeColumn('employeeLeaveBalanceDetails', 'fiscalYearStart', { transaction });
            await queryInterface.removeColumn('employeeLeaveBalanceDetails', 'fiscalYearEnd', { transaction });
        });

        console.log('Completed rollback: Fiscal year columns updated in employeeLeaveBalanceDetails table');
    } catch(error) {
        console.log(error);
    }
  }
};