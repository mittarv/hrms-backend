'use strict';

import { QueryInterface } from 'sequelize';

module.exports = {
  async up(queryInterface: QueryInterface): Promise<void> {
    console.log('Started migration: Adding OFTE to employeecomponentconfigurators table');
    
    await queryInterface.sequelize.query(`
      UPDATE employeecomponentconfigurators 
      SET componentValue = JSON_SET(
        componentValue, 
        '$.ofte_key', 
        'OFTE'
      )
      WHERE componentType = 'emp_type_dropdown'
    `);
    
    console.log('Completed migration: Added ofte_key to emp_type_dropdown componentValue');

    console.log('Started migration: Adding new employee level to employeelevels table');
    
    // Add new levels to the level_dropdown componentValue JSON
    await queryInterface.sequelize.query(`
      UPDATE employeecomponentconfigurators 
      SET componentValue = JSON_SET(
        componentValue,
        '$."15"', 'Level 1',
        '$."16"', 'Level 2', 
        '$."17"', 'Level 3'
      )
      WHERE componentType = 'level_dropdown'
    `);
    
    console.log('Completed migration: Added Level 1, Level 2, Level 3 to level_dropdown componentValue');
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    console.log('Started rollback: Removing ofte_key from employeecomponentconfigurators table');

    // Remove the ofte_key from componentValue JSON
    await queryInterface.sequelize.query(`
      UPDATE employeecomponentconfigurators 
      SET componentValue = JSON_REMOVE(
        componentValue, 
        '$.ofte_key'
      )
      WHERE componentType = 'emp_type_dropdown'
    `);
    
    console.log('Completed rollback: Removed ofte_key from emp_type_dropdown componentValue');

    console.log('Started rollback: Removing new employee levels from level_dropdown');

    // Remove the new levels from componentValue JSON
    await queryInterface.sequelize.query(`
      UPDATE employeecomponentconfigurators 
      SET componentValue = JSON_REMOVE(
        componentValue,
        '$."15"',
        '$."16"', 
        '$."17"'
      )
      WHERE componentType = 'level_dropdown'
    `);
    
    console.log('Completed rollback: Removed Level 1, Level 2, Level 3 from level_dropdown componentValue');
  }
};