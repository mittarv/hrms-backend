'use strict';

import { QueryInterface } from 'sequelize';

module.exports = {
  async up(queryInterface: QueryInterface): Promise<void> {
    console.log('Started migration: Adding leadership_key to employeecomponentconfigurators table');
    
    await queryInterface.sequelize.query(`
      UPDATE employeecomponentconfigurators 
      SET componentValue = JSON_SET(
        componentValue, 
        '$.leadership_key', 
        'Leadership'
      )
      WHERE componentType = 'department_type_dropdown'
    `);
    
    console.log('Completed migration: Added leadership_key to department_type_dropdown componentValue');
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    console.log('Started rollback: Removing leadership_key from employeecomponentconfigurators table');

    // Remove the leadership_key from componentValue JSON
    await queryInterface.sequelize.query(`
      UPDATE employeecomponentconfigurators 
      SET componentValue = JSON_REMOVE(
        componentValue, 
        '$.leadership_key'
      )
      WHERE componentType = 'department_type_dropdown'
    `);

    console.log('Completed rollback: Removed leadership_key from department_type_dropdown componentValue');
  }
};