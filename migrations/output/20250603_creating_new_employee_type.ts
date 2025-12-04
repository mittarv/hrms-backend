'use strict';

import { QueryInterface } from 'sequelize';

module.exports = {
  async up(queryInterface: QueryInterface): Promise<void> {
    console.log('Started migration: Adding extended_inter_key to employeecomponentconfigurators table');
    
    await queryInterface.sequelize.query(`
      UPDATE employeecomponentconfigurators 
      SET componentValue = JSON_SET(
        componentValue, 
        '$.extended_intern_key', 
        'Extended Intern'
      )
      WHERE componentType = 'emp_type_dropdown'
    `);
    
    console.log('Completed migration: Added extended_intern_key to emp_type_dropdown componentValue');
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    console.log('Started rollback: Removing extended_inter_key from employeecomponentconfigurators table');
    
    // Remove the extended_inter_key from componentValue JSON
    await queryInterface.sequelize.query(`
      UPDATE employeecomponentconfigurators 
      SET componentValue = JSON_REMOVE(
        componentValue, 
        '$.extended_intern_key'
      )
      WHERE componentType = 'emp_type_dropdown'
    `);
    
    console.log('Completed rollback: Removed extended_intern_key from emp_type_dropdown componentValue');
  }
};