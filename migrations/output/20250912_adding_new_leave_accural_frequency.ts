'use strict';

import { QueryInterface } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface): Promise<void> {
    console.log('Started migration: Updating leave accrual frequency configuration');

    try {
      const updatedComponentValue = JSON.stringify({
        monthly_key: ["Monthly", "12"],
        quarterly_key: ["Quarterly", "4"], 
        half_yearly_key: ["Half-Yearly", "2"],
        annually_key: ["Annually", "1"],
        one_time_key: ["One Time", "0"] 
      });

      await queryInterface.sequelize.query(`
        UPDATE employeecomponentconfigurators 
        SET componentValue = :componentValue,
            updatedAt = NOW()
        WHERE componentType = 'leave_accural_frequency'
      `, {
        replacements: { componentValue: updatedComponentValue }
      });

      console.log('Completed migration: Updated leave accrual frequency configuration');
    } catch (error) {
      console.log('Failed to update leave accrual frequency configuration');
      console.error('Error:', error);
      throw error;
    }
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    console.log('Started rollback: Reverting leave accrual frequency configuration');
    
    try {
      // Revert to the original componentValue
      const originalComponentValue = JSON.stringify({
        monthly_key: ["Monthly", "12"],
        quaterly_key: ["Quaterly", "4"], // Original spelling and value
        half_yearly_key: ["Half-Yearly", "2"],
        annually_key: ["Annually", "1"]
        // one_time_key removed
      });

      await queryInterface.sequelize.query(`
        UPDATE employeecomponentconfigurators 
        SET componentValue = :componentValue,
            updatedAt = NOW()
        WHERE componentType = 'leave_accural_frequency'
      `, {
        replacements: { componentValue: originalComponentValue }
      });

      console.log('Completed rollback: Reverted leave accrual frequency configuration');
    } catch (error) {
      console.log('Failed to revert leave accrual frequency configuration');
      console.error('Error:', error);
      throw error;
    }
  }
};
