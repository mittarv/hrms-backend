'use strict';

import { QueryInterface } from 'sequelize';

module.exports = {
  async up(queryInterface: QueryInterface): Promise<void> {
    console.log('Started migration: Adding new location to employeecomponentconfigurators table');

    await queryInterface.sequelize.query(`
      UPDATE employeecomponentconfigurators 
      SET componentValue = JSON_SET(
        componentValue, 
        '$.onsite_relocated_key', 
        'On Site- Relocated',
        '$.onsite_hyderabad_key',
        'On Site- Hyderabad',
        '$.hybrid_relocated_key',
        'Hybrid- Relocated',
        '$.hybrid_hyderabad_key',
        'Hybrid- Hyderabad'
      )
      WHERE componentType = 'location_dropdown'
    `);

    console.log('Completed migration: Added new location keys to location_dropdown componentValue');
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    console.log('Started rollback: Removing new location keys from employeecomponentconfigurators table');

    // Remove the new location keys from componentValue JSON
    await queryInterface.sequelize.query(`
      UPDATE employeecomponentconfigurators 
      SET componentValue = JSON_REMOVE(
        componentValue, 
        '$.onsite_relocated_key',
        '$.onsite_hyderabad_key',
        '$.hybrid_relocated_key',
        '$.hybrid_hyderabad_key'
      )
      )
      WHERE componentType = 'location_dropdown'
    `);

    console.log('Completed rollback: Removed new location keys from location_dropdown componentValue');
  }
};