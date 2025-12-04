'use strict';

import { QueryInterface, DataTypes } from 'sequelize';

module.exports = {
  async up(queryInterface: QueryInterface): Promise<void> {
    console.log('Started migration: Adding columns to employeejobdetails & employeejobdetailhistories table');
    await queryInterface.addColumn('employeejobdetails', 'empYearOfStudy', {
      type: DataTypes.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('employeejobdetailhistories', 'empYearOfStudy', {
      type: DataTypes.STRING,
      allowNull: true,
    });
    console.log('Completed migration: Columns added to employeejobdetails & employeejobdetailhistories table');
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    console.log('Started rollback: Removing columns from employeejobdetails & employeejobdetailhistories table');
    await queryInterface.removeColumn('employeejobdetails', 'empYearOfStudy');
    await queryInterface.removeColumn('employeejobdetailhistories', 'empYearOfStudy');
    console.log('Completed rollback: Columns removed from employeejobdetails & employeejobdetailhistories table');
  }
};