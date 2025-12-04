'use strict';

import { QueryInterface, DataTypes } from 'sequelize';

module.exports = {
  async up(queryInterface: QueryInterface): Promise<void> {
    console.log('Started migration: Adding empType column to employeeLeaveBalanceDetails table');
    await queryInterface.addColumn('employeeLeaveBalanceDetails', 'empType', {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'fte_key',
    });

    console.log('Completed migration: empType column added to employeeLeaveBalanceDetails table');
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    console.log('Started rollback: Removing empType column from employeeLeaveBalanceDetails table');
    await queryInterface.removeColumn('employeeLeaveBalanceDetails', 'empType');
    console.log('Completed rollback: empType column removed from employeeLeaveBalanceDetails table');
  }
};