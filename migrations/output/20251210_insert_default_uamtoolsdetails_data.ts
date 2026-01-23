'use strict';

import { QueryInterface } from "sequelize";

interface UAMToolsDetailsInsert {
    toolId: number;
    name: string;
    description: string;
    remark: string | null;
    link: string | null;
    adminId: number | null;
    startDate: Date;
    endDate: Date;
    updatedBy: number;
    isDeleted: boolean;
    createdAt: Date;
    updatedAt: Date;
}

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        await queryInterface.sequelize.transaction(async (transaction) => {
            console.log('Starting UAM Tools Details default data insertion...');
            
            const now = new Date();
            
            // Define default tools
            const toolsToInsert: UAMToolsDetailsInsert[] = [
                {
                    toolId: 1,
                    name: 'HR Repository',
                    description: 'One-Stop Access to Essential Policies and Links',
                    remark: null,
                    link: '/dashboard',
                    adminId: null,
                    startDate: now,
                    endDate: now,
                    updatedBy: 1,
                    isDeleted: false,
                    createdAt: now,
                    updatedAt: now
                },
                {
                    toolId: 2,
                    name: 'User Access Management',
                    description: 'Manage the tools',
                    remark: null,
                    link: '/mittarv-tools',
                    adminId: null,
                    startDate: now,
                    endDate: now,
                    updatedBy: 1,
                    isDeleted: false,
                    createdAt: now,
                    updatedAt: now
                }
            ];

            console.log(`Inserting ${toolsToInsert.length} default tools...`);
            
            // Bulk insert tools
            await queryInterface.bulkInsert(
                'uamtoolsdetails',
                toolsToInsert,
                { transaction }
            );

            console.log('UAM Tools Details default data insertion completed successfully!');
            console.log('Inserted tools:');
            toolsToInsert.forEach(tool => {
                console.log(`  - ${tool.name}: ${tool.description}`);
            });
        });
    },

    down: async (queryInterface: QueryInterface) => {
        await queryInterface.sequelize.transaction(async (transaction) => {
            console.log('Rolling back UAM Tools Details default data...');
            
            // Delete the inserted tools by their IDs
            await queryInterface.bulkDelete(
                'uamtoolsdetails',
                {
                    toolId: [1, 2]
                },
                { transaction }
            );

            console.log('UAM Tools Details rollback completed successfully!');
        });
    }
};