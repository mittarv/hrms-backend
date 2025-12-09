'use strict';

import { QueryInterface } from "sequelize";
import { createUUIDV4 } from "../../utilities/uuidV4Generator";
import { componentTypes } from "../../interfaces/hrmsTool/enum/hrmsEnum";

interface SalaryCategoryInsert {
    salaryCategoryId: string;
    employeeType: string;
    employeeLocation: string;
    employeeLevel: string | null; // Changed to allow null
    department?: string | null; // Added for Intern/Extended Intern
    yearOfStudy?: string | null; // Added for Intern/Extended Intern
    isDeleted: boolean;
    createdAt: Date;
    updatedAt: Date;
}

interface SalaryComponentInsert {
    componentId: string;
    salaryCategoryId: string;
    componentName: string;
    componentType: string;
    amount: number;
    isVariable: boolean;
    includeinLop: boolean;
    isDeleted: boolean;
    isDefault: boolean;
    createdBy: string;
    updatedBy: string;
    createdAt: Date;
    updatedAt: Date;
}

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        await queryInterface.sequelize.transaction(async (transaction) => {
            console.log('Starting salary categories and components creation...');
            
            // Define all possible combinations based on your component data
            const employeeTypes = [
                'fte_key', 'pte_key', 'ofte_key', 'intern_key', 
                'consultant_key', 'contractor_key', 'extended_intern_key'
            ];
            
            const employeeLocations = [
                'hybrid_key', 'remote_key', 'on_site_key', 
                'hybrid_hyderabad_key', 'hybrid_relocated_key', 
                'onsite_hyderabad_key', 'onsite_relocated_key'
            ];
            
            // Level configurations by employee type
            const fteLevels = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14'];
            const oftePteLevels = ['15', '16', '17'];
            const internLevels = ['18', '19']; // Trainee and Intern levels
            const otherEmployeeTypes = ['consultant_key', 'contractor_key'];
            
            // Department types for Intern/Extended Intern
            const departments = [
                'cdm_key', 'sde_key', 'half_key', 'design_key', 'product_key',
                'project_key', 'graphics_key', 'analytics_key', 'leadership_key',
                'it_security_key', 'business_dev_key'
            ];
            
            // Year of study for Intern/Extended Intern
            const yearsOfStudy = ['0', '1', '2', '3', '4']; // 1st, 2nd, 3rd, 4th, N/A
            
            // Arrays to store bulk insert data
            const salaryCategoriesToInsert: SalaryCategoryInsert[] = [];
            const salaryComponentsToInsert: SalaryComponentInsert[] = [];
            
            // Calculate total combinations: 
            // FTE(7×15) + OFTE(7×3) + PTE(7×3) + Intern(7×2×11×5) + Extended Intern(7×2×11×5) + Others(2×7×1) = 175 + 770 + 770 + 14 = 1729
            console.log('Generating salary categories for different employee types...');
            
            // Generate combinations for each employee type
            for (const empType of employeeTypes) {
                for (const empLocation of employeeLocations) {
                    let levelsToProcess: (string | null)[] = []; // Changed to allow null
                    
                    // Determine levels based on employee type
                    if (empType === 'fte_key') {
                        levelsToProcess = fteLevels; // 0-14
                    } else if (empType === 'ofte_key' || empType === 'pte_key') {
                        levelsToProcess = oftePteLevels; // 15-17
                    } else if (empType === 'intern_key' || empType === 'extended_intern_key') {
                        levelsToProcess = internLevels; // 18-19 (Trainee, Intern)
                    } else if (otherEmployeeTypes.includes(empType)) {
                        levelsToProcess = [null]; // Use null for types without levels
                    }
                    
                    // Create combinations for this employee type and location
                    for (const empLevel of levelsToProcess) {
                        // For Intern and Extended Intern, also loop through departments and years of study
                        if (empType === 'intern_key' || empType === 'extended_intern_key') {
                            for (const department of departments) {
                                for (const yearOfStudy of yearsOfStudy) {
                                    // Generate unique category ID
                                    const salaryCategoryId = await createUUIDV4();
                                    
                                    // Create salary category with department and yearOfStudy
                                    salaryCategoriesToInsert.push({
                                        salaryCategoryId,
                                        employeeType: empType,
                                        employeeLocation: empLocation,
                                        employeeLevel: empLevel,
                                        department: department,
                                        yearOfStudy: yearOfStudy,
                                        isDeleted: false,
                                        createdAt: new Date(),
                                        updatedAt: new Date()
                                    });
                                    
                                    // Create default components for this category
                                    const baseSalaryId = await createUUIDV4();
                                    const lopId = await createUUIDV4();
                                    
                                    // Basic Salary component
                                    salaryComponentsToInsert.push({
                                        componentId: baseSalaryId,
                                        salaryCategoryId,
                                        componentName: 'Basic Salary',
                                        componentType: componentTypes.DEFAULT_ADDITION,
                                        amount: 0,
                                        isVariable: false,
                                        includeinLop: false,
                                        isDeleted: false,
                                        isDefault: true,
                                        createdBy: 'system',
                                        updatedBy: 'system',
                                        createdAt: new Date(),
                                        updatedAt: new Date()
                                    });
                                    
                                    // Loss of Pay component
                                    salaryComponentsToInsert.push({
                                        componentId: lopId,
                                        salaryCategoryId,
                                        componentName: 'Loss of Pay(per day)',
                                        componentType: componentTypes.DEFAULT_DEDUCTION,
                                        amount: 0,
                                        isVariable: false,
                                        includeinLop: false,
                                        isDeleted: false,
                                        isDefault: true,
                                        createdBy: 'system',
                                        updatedBy: 'system',
                                        createdAt: new Date(),
                                        updatedAt: new Date()
                                    });
                                }
                            }
                        } else {
                            // For all other employee types (FTE, OFTE, PTE, Consultant, Contractor)
                            // Generate unique category ID
                            const salaryCategoryId = await createUUIDV4();
                            
                            // Create salary category without department and yearOfStudy
                            salaryCategoriesToInsert.push({
                                salaryCategoryId,
                                employeeType: empType,
                                employeeLocation: empLocation,
                                employeeLevel: empLevel, // Will be null for types without levels
                                department: null,
                                yearOfStudy: null,
                                isDeleted: false,
                                createdAt: new Date(),
                                updatedAt: new Date()
                            });
                            
                            // Create default components for this category
                            const baseSalaryId = await createUUIDV4();
                            const lopId = await createUUIDV4();
                            
                            // Basic Salary component
                            salaryComponentsToInsert.push({
                                componentId: baseSalaryId,
                                salaryCategoryId,
                                componentName: 'Basic Salary',
                                componentType: componentTypes.DEFAULT_ADDITION,
                                amount: 0,
                                isVariable: false,
                                includeinLop: false,
                                isDeleted: false,
                                isDefault: true,
                                createdBy: 'system',
                                updatedBy: 'system',
                                createdAt: new Date(),
                                updatedAt: new Date()
                            });
                            
                            // Loss of Pay component
                            salaryComponentsToInsert.push({
                                componentId: lopId,
                                salaryCategoryId,
                                componentName: 'Loss of Pay(per day)',
                                componentType: componentTypes.DEFAULT_DEDUCTION,
                                amount: 0,
                                isVariable: false,
                                includeinLop: false,
                                isDeleted: false,
                                isDefault: true,
                                createdBy: 'system',
                                updatedBy: 'system',
                                createdAt: new Date(),
                                updatedAt: new Date()
                            });
                        }
                    }
                }
            }
            
            console.log(`Inserting ${salaryCategoriesToInsert.length} salary categories...`);
            // Bulk insert salary categories
            await queryInterface.bulkInsert('salaryCategories', salaryCategoriesToInsert, { transaction });
            
            console.log(`Inserting ${salaryComponentsToInsert.length} salary components...`);
            // Bulk insert salary components
            await queryInterface.bulkInsert('salary_components', salaryComponentsToInsert, { transaction });
            
            console.log('Salary categories and components creation completed successfully!');
        });
    },
    down: async (queryInterface: QueryInterface) => {
        await queryInterface.sequelize.transaction(async (transaction) => {
            console.log('Starting rollback of salary categories and components...');
            
            // Define the same combinations used in 'up' migration
            const employeeTypes = [
                'fte_key', 'pte_key', 'ofte_key', 'intern_key', 
                'consultant_key', 'contractor_key', 'extended_intern_key'
            ];
            
            const employeeLocations = [
                'hybrid_key', 'remote_key', 'on_site_key', 
                'hybrid_hyderabad_key', 'hybrid_relocated_key', 
                'onsite_hyderabad_key', 'onsite_relocated_key'
            ];
            
            // Delete salary components first (due to foreign key constraint)
            console.log('Deleting salary components...');
            await queryInterface.bulkDelete('salaryComponents', {
                componentName: ['Basic Salary', 'Loss of Pay'],
                createdBy: 'system',
                isDefault: true
            }, { transaction });
            
            // Delete all salary categories for these combinations
            console.log('Deleting salary categories...');
            await queryInterface.bulkDelete('salaryCategories', {
                employeeType: employeeTypes,
                employeeLocation: employeeLocations
            }, { transaction });
            
            console.log('Rollback completed successfully!');
        });
    }
};