'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Update the emp_type_dropdown configuration to fix extended_inter_key to extended_intern_key
    await queryInterface.sequelize.query(`
      UPDATE employeecomponentconfigurators
      SET componentValue = JSON_REPLACE(
        componentValue,
        '$.extended_inter_key', JSON_EXTRACT(componentValue, '$.extended_inter_key')
      )
      WHERE componentType = 'emp_type_dropdown'
      AND JSON_EXTRACT(componentValue, '$.extended_inter_key') IS NOT NULL;
    `);

    // Remove the old key and add the new key with correct name
    await queryInterface.sequelize.query(`
      UPDATE employeecomponentconfigurators
      SET componentValue = JSON_REMOVE(componentValue, '$.extended_inter_key')
      WHERE componentType = 'emp_type_dropdown';
    `);

    await queryInterface.sequelize.query(`
      UPDATE employeecomponentconfigurators
      SET componentValue = JSON_SET(componentValue, '$.extended_intern_key', 'Extended Intern')
      WHERE componentType = 'emp_type_dropdown';
    `);

    // Update all employee job details that have 'extended_inter_key' to 'extended_intern_key'
    await queryInterface.sequelize.query(`
      UPDATE employeejobdetails
      SET empType = 'extended_intern_key'
      WHERE empType = 'extended_inter_key';
    `);

    // Update salary categories if they have 'extended_inter' to 'extended_intern'
    await queryInterface.sequelize.query(`
      UPDATE salarycategories
      SET employeeType = 'extended_intern'
      WHERE employeeType = 'extended_inter';
    `);
  },

  async down(queryInterface, Sequelize) {
    // Revert the changes
    await queryInterface.sequelize.query(`
      UPDATE employeecomponentconfigurators
      SET componentValue = JSON_REMOVE(componentValue, '$.extended_intern_key')
      WHERE componentType = 'emp_type_dropdown';
    `);

    await queryInterface.sequelize.query(`
      UPDATE employeecomponentconfigurators
      SET componentValue = JSON_SET(componentValue, '$.extended_inter_key', 'Extended Intern')
      WHERE componentType = 'emp_type_dropdown';
    `);

    await queryInterface.sequelize.query(`
      UPDATE employeejobdetails
      SET empType = 'extended_inter_key'
      WHERE empType = 'extended_intern_key';
    `);

    await queryInterface.sequelize.query(`
      UPDATE salarycategories
      SET employeeType = 'extended_inter'
      WHERE employeeType = 'extended_intern';
    `);
  }
};
