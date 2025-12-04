'use strict';

import { QueryInterface, DataTypes } from 'sequelize';

module.exports = {
  async up(queryInterface: QueryInterface): Promise<void> {
    console.log('Started migration: Adding columns to employeeLeaveConfigurators table');
    await queryInterface.addColumn('employeeLeaveConfigurators', 'isDefault', {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn('employeeLeaveConfigurators', 'leaveApplicableTo', {
      type: DataTypes.TEXT('long'),
      allowNull: true,
    });
    console.log('Completed migration: Columns added to employeeLeaveConfigurators table');
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    console.log('Started rollback: Removing columns from employeeLeaveConfigurators table');
    await queryInterface.removeColumn('employeeLeaveConfigurators', 'isDefault');
    await queryInterface.removeColumn('employeeLeaveConfigurators', 'leaveApplicableTo');
    console.log('Completed rollback: Columns removed from employeeLeaveConfigurators table');
  }
};