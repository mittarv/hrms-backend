'use strict';
import { QueryInterface } from 'sequelize';

module.exports = {
  async up(queryInterface: QueryInterface): Promise<void> {
    console.log('Started migration: Adding graphics_key, business_dev_key, and it_security_key to department_type_dropdown in employeecomponentconfigurators table');
    
    // Add Graphics department
    await queryInterface.sequelize.query(`
      UPDATE employeecomponentconfigurators 
      SET componentValue = JSON_SET(
        componentValue, 
        '$.graphics_key', 
        'Graphics'
      )
      WHERE componentType = 'department_type_dropdown'
    `);
    
    // Add Business Dev department
    await queryInterface.sequelize.query(`
      UPDATE employeecomponentconfigurators 
      SET componentValue = JSON_SET(
        componentValue, 
        '$.business_dev_key', 
        'Business Dev'
      )
      WHERE componentType = 'department_type_dropdown'
    `);
    
    // Add IT Security department
    await queryInterface.sequelize.query(`
      UPDATE employeecomponentconfigurators 
      SET componentValue = JSON_SET(
        componentValue, 
        '$.it_security_key', 
        'IT Security'
      )
      WHERE componentType = 'department_type_dropdown'
    `);
    
    console.log('Completed migration: Added graphics_key, business_dev_key, and it_security_key to department_type_dropdown componentValue');
    
    // Add J++ level to level_dropdown
    console.log('Started migration: Adding J++ level to level_dropdown in employeecomponentconfigurators table');
    
    await queryInterface.sequelize.query(`
      UPDATE employeecomponentconfigurators 
      SET componentValue = JSON_OBJECT(
        '0', 'Level G',
        '1', 'Level G+',
        '2', 'Level H',
        '3', 'Level H+',
        '4', 'Level H++',
        '5', 'Level J',
        '6', 'Level J+',
        '7', 'Level J++',
        '8', 'Level K',
        '9', 'Level K+',
        '10', 'Level K++',
        '11', 'Level L',
        '12', 'Level L+',
        '13', 'Level L++',
        '14', 'Level M'
      ),
      updatedAt = NOW()
      WHERE componentType = 'level_dropdown'
    `);
    
    console.log('Completed migration: Added J++ level to level_dropdown componentValue');
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    console.log('Started rollback: Removing graphics_key, business_dev_key, and it_security_key from department_type_dropdown in employeecomponentconfigurators table');
    
    // Remove Graphics department
    await queryInterface.sequelize.query(`
      UPDATE employeecomponentconfigurators 
      SET componentValue = JSON_REMOVE(
        componentValue, 
        '$.graphics_key'
      )
      WHERE componentType = 'department_type_dropdown'
    `);
    
    // Remove Business Dev department
    await queryInterface.sequelize.query(`
      UPDATE employeecomponentconfigurators 
      SET componentValue = JSON_REMOVE(
        componentValue, 
        '$.business_dev_key'
      )
      WHERE componentType = 'department_type_dropdown'
    `);
    
    // Remove IT Security department
    await queryInterface.sequelize.query(`
      UPDATE employeecomponentconfigurators 
      SET componentValue = JSON_REMOVE(
        componentValue, 
        '$.it_security_key'
      )
      WHERE componentType = 'department_type_dropdown'
    `);
    
    console.log('Completed rollback: Removed graphics_key, business_dev_key, and it_security_key from department_type_dropdown componentValue');
    
    // Remove J++ level from level_dropdown
    console.log('Started rollback: Removing J++ level from level_dropdown in employeecomponentconfigurators table');
    
    await queryInterface.sequelize.query(`
      UPDATE employeecomponentconfigurators 
      SET componentValue = JSON_OBJECT(
        '0', 'Level G',
        '1', 'Level G+',
        '2', 'Level H',
        '3', 'Level H+',
        '4', 'Level H++',
        '5', 'Level J',
        '6', 'Level J+',
        '7', 'Level K',
        '8', 'Level K+',
        '9', 'Level K++',
        '10', 'Level L',
        '11', 'Level L+',
        '12', 'Level L++',
        '13', 'Level M'
      ),
      updatedAt = NOW()
      WHERE componentType = 'level_dropdown'
    `);
    
    console.log('Completed rollback: Removed J++ level from level_dropdown componentValue');
  }
};