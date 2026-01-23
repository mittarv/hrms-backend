'use strict';

import { QueryInterface } from "sequelize";

interface UAMUserGroupInsert {
    id: number;
    role: string;
    value: number;
    view: boolean;
    modify: boolean;
    approver: boolean;
    addmembers: boolean;
    updatedBy: number | null;
    isDeleted: boolean;
    createdAt: Date;
    updatedAt: Date;
}

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        await queryInterface.sequelize.transaction(async (transaction) => {
            console.log('Starting UAM User Groups default data insertion...');
            
            const now = new Date();
            
            // Define default user groups with their permissions
            const userGroupsToInsert: UAMUserGroupInsert[] = [
                {
                    id: 1,
                    role: 'Viewer',
                    value: 100,
                    view: true,
                    modify: false,
                    approver: false,
                    addmembers: false,
                    updatedBy: null,
                    isDeleted: false,
                    createdAt: now,
                    updatedAt: now
                },
                {
                    id: 2,
                    role: 'Editor',
                    value: 200,
                    view: true,
                    modify: true,
                    approver: false,
                    addmembers: false,
                    updatedBy: null,
                    isDeleted: false,
                    createdAt: now,
                    updatedAt: now
                },
                {
                    id: 3,
                    role: 'Tool Admin',
                    value: 500,
                    view: true,
                    modify: true,
                    approver: true,
                    addmembers: true,
                    updatedBy: null,
                    isDeleted: false,
                    createdAt: now,
                    updatedAt: now
                },
                {
                    id: 4,
                    role: 'Super Admin',
                    value: 900,
                    view: true,
                    modify: true,
                    approver: true,
                    addmembers: true,
                    updatedBy: null,
                    isDeleted: false,
                    createdAt: now,
                    updatedAt: now
                }
            ];

            console.log(`Inserting ${userGroupsToInsert.length} default user groups...`);
            
            // Bulk insert user groups
            await queryInterface.bulkInsert(
                'uamusergroups',
                userGroupsToInsert,
                { transaction }
            );

            console.log('UAM User Groups default data insertion completed successfully!');
            console.log('Inserted roles:');
            userGroupsToInsert.forEach(group => {
                console.log(`  - ${group.role} (value: ${group.value})`);
            });
        });
    },

    down: async (queryInterface: QueryInterface) => {
        await queryInterface.sequelize.transaction(async (transaction) => {
            console.log('Rolling back UAM User Groups default data...');
            
            // Delete the inserted user groups by their IDs
            await queryInterface.bulkDelete(
                'uamusergroups',
                {
                    id: [1, 2, 3, 4]
                },
                { transaction }
            );

            console.log('UAM User Groups rollback completed successfully!');
        });
    }
};