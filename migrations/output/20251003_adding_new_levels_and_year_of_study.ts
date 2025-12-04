'use strict';

import { QueryInterface } from "sequelize";
import { dbOutput } from "../../models/index";

const EmployeeComponentConfigurator = dbOutput.employeeComponentConfigurator;

module.exports = {
  async up(queryInterface: QueryInterface): Promise<void> {
    console.log('Started migration: Adding Trainee and Intern to level_dropdown and creating year_of_study component');

    try {
      // Add Trainee and Intern to existing level_dropdown
      console.log('Adding Trainee and Intern to level_dropdown componentValue');
      
      await queryInterface.sequelize.query(`
        UPDATE employeecomponentconfigurators 
        SET componentValue = JSON_SET(
          componentValue,
          '$."18"', 'Trainee',
          '$."19"', 'Intern'
        ),
        updatedAt = NOW()
        WHERE componentType = 'level_dropdown'
      `);

      console.log('Successfully added Trainee and Intern to level_dropdown');

      // Create new year_of_study component
      console.log('Creating year_of_study component');
      
      const yearOfStudyComponent = JSON.stringify({
        "0": "1st",
        "1": "2nd", 
        "2": "3rd",
        "3": "4th",
        "4": "N/A"
      });

      // Check if year_of_study component already exists
      const existingComponent = await EmployeeComponentConfigurator.findOne({
        where: {
          componentType: "year_of_study",
          isDeleted: false
        }
      });

      if (existingComponent) {
        console.log('year_of_study component already exists, updating it');
        await existingComponent.update({
          componentValue: yearOfStudyComponent,
          updatedAt: new Date()
        });
      } else {
        console.log('Creating new year_of_study component');
        await EmployeeComponentConfigurator.create({
          componentType: "year_of_study",
          componentValue: yearOfStudyComponent,
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      console.log('Successfully created year_of_study component');
      console.log('Completed migration: Added Trainee and Intern to level_dropdown and created year_of_study component');

    } catch (error) {
      console.error('Error in migration:', error);
      throw error;
    }
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    console.log('Started rollback: Removing Trainee and Intern from level_dropdown and removing year_of_study component');

    try {
      // Remove Trainee and Intern from level_dropdown
      console.log('Removing Trainee and Intern from level_dropdown componentValue');
      
      await queryInterface.sequelize.query(`
        UPDATE employeecomponentconfigurators 
        SET componentValue = JSON_REMOVE(
          componentValue,
          '$."18"',
          '$."19"'
        ),
        updatedAt = NOW()
        WHERE componentType = 'level_dropdown'
      `);

      console.log('Successfully removed Trainee and Intern from level_dropdown');

      // Remove year_of_study component
      console.log('Removing year_of_study component');
      
      await EmployeeComponentConfigurator.destroy({
        where: {
          componentType: "year_of_study"
        }
      });

      console.log('Successfully removed year_of_study component');
      console.log('Completed rollback: Removed Trainee and Intern from level_dropdown and removed year_of_study component');

    } catch (error) {
      console.error('Error in rollback:', error);
      throw error;
    }
  }
};
