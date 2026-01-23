'use strict';

import { QueryInterface } from "sequelize";

const leaveConfiguratorsData = [
  {
    leaveConfigId: "45467caf-daf8-472a-873f-f8dc479445a9",
    leaveType: "Optional",
    employeeType: "[\"fte_key\",\"pte_key\",\"intern_key\",\"contractor_key\",\"consultant_key\"]",
    accuralFrequency: "2",
    totalAllotedLeaves: 12,
    accuralRate: 2,
    minimumNoticePeriod: 14,
    maximumNoticePeriod: 0,
    continuousLeavesLimit: 5,
    excludePaidWeekend: 0,
    appliedGender: "[\"male_key\",\"female_key\",\"other_key\"]",
    isHalfDayAllowed: 1,
    isProofRequired: 0,
    isReasonRequired: 1,
    effectiveDate: new Date("2025-10-13T10:19:57.000Z"),
    terminationDate: null,
    isActive: 1,
    createdAt: new Date("2025-10-13T10:19:57.000Z"),
    updatedAt: new Date("2025-10-13T10:24:40.000Z"),
    isDefault: 1,
    leaveApplicableTo: "null",
    allotAllLeaves: 1
  },
  {
    leaveConfigId: "4cef5128-4756-4778-bd8b-f7ab0d12085d",
    leaveType: "Casual",
    employeeType: "[\"fte_key\",\"pte_key\",\"contractor_key\",\"intern_key\",\"consultant_key\"]",
    accuralFrequency: "3",
    totalAllotedLeaves: 15,
    accuralRate: 3.75,
    minimumNoticePeriod: 14,
    maximumNoticePeriod: 0,
    continuousLeavesLimit: 15,
    excludePaidWeekend: 0,
    appliedGender: "[\"female_key\"]",
    isHalfDayAllowed: 1,
    isProofRequired: 0,
    isReasonRequired: 1,
    effectiveDate: new Date("2025-10-13T10:19:57.000Z"),
    terminationDate: null,
    isActive: 1,
    createdAt: new Date("2025-10-13T10:19:57.000Z"),
    updatedAt: new Date("2025-11-08T14:31:27.000Z"),
    isDefault: 1,
    leaveApplicableTo: "{\"fte_key\":{\"value\":2,\"unit\":\"Days\"},\"pte_key\":{\"value\":30,\"unit\":\"Days\"},\"contractor_key\":{\"value\":2,\"unit\":\"Months\"},\"intern_key\":{\"value\":2,\"unit\":\"Weeks\"},\"consultant_key\":{\"value\":1,\"unit\":\"Months\"}}",
    allotAllLeaves: 1
  },
  {
    leaveConfigId: "63847a1e-1ef9-4ef3-a6a1-86b6f0eb8bd1",
    leaveType: "Sick",
    employeeType: "[\"fte_key\",\"pte_key\",\"contractor_key\",\"intern_key\",\"consultant_key\"]",
    accuralFrequency: "2",
    totalAllotedLeaves: 10,
    accuralRate: 1.66667,
    minimumNoticePeriod: 0,
    maximumNoticePeriod: 3,
    continuousLeavesLimit: 1,
    excludePaidWeekend: 0,
    appliedGender: "[\"male_key\",\"female_key\",\"other_key\"]",
    isHalfDayAllowed: 0,
    isProofRequired: 1,
    isReasonRequired: 1,
    effectiveDate: new Date("2025-10-13T10:19:57.000Z"),
    terminationDate: null,
    isActive: 1,
    createdAt: new Date("2025-10-13T10:19:57.000Z"),
    updatedAt: new Date("2025-11-10T05:55:11.000Z"),
    isDefault: 1,
    leaveApplicableTo: "{\"fte_key\":{\"value\":2,\"unit\":\"Days\"},\"pte_key\":{\"value\":1,\"unit\":\"Months\"},\"contractor_key\":{\"value\":30,\"unit\":\"Days\"},\"intern_key\":{\"value\":1,\"unit\":\"Months\"},\"consultant_key\":{\"value\":2,\"unit\":\"Weeks\"}}",
    allotAllLeaves: 0
  },
  {
    leaveConfigId: "dc9fe583-2904-4b7e-b639-e33462743278",
    leaveType: "Unpaid",
    employeeType: "[\"fte_key\",\"pte_key\",\"contractor_key\",\"intern_key\",\"consultant_key\"]",
    accuralFrequency: "6",
    totalAllotedLeaves: 90,
    accuralRate: 45,
    minimumNoticePeriod: 0,
    maximumNoticePeriod: 0,
    continuousLeavesLimit: 7,
    excludePaidWeekend: 0,
    appliedGender: "[\"female_key\",\"other_key\",\"male_key\"]",
    isHalfDayAllowed: 0,
    isProofRequired: 0,
    isReasonRequired: 1,
    effectiveDate: new Date("2025-10-13T10:19:57.000Z"),
    terminationDate: null,
    isActive: 1,
    createdAt: new Date("2025-10-13T10:19:57.000Z"),
    updatedAt: new Date("2025-10-13T10:25:45.000Z"),
    isDefault: 1,
    leaveApplicableTo: "null",
    allotAllLeaves: 1
  },
  {
    leaveConfigId: "db48e78c-5a8e-46fb-a6f9-e47c0e5ea101",
    leaveType: "Comp Off",
    employeeType: "[\"fte_key\",\"pte_key\"]",
    accuralFrequency: "1",
    totalAllotedLeaves: 0,
    accuralRate: 0,
    minimumNoticePeriod: 10,
    maximumNoticePeriod: 10,
    continuousLeavesLimit: 5,
    excludePaidWeekend: 1,
    appliedGender: "[\"male_key\",\"female_key\"]",
    isHalfDayAllowed: 1,
    isProofRequired: 1,
    isReasonRequired: 1,
    effectiveDate: new Date("2025-12-16T05:51:19.000Z"),
    terminationDate: null,
    isActive: 1,
    createdAt: new Date("2025-12-16T05:51:19.000Z"),
    updatedAt: new Date("2026-01-20T09:17:55.000Z"),
    isDefault: 1,
    leaveApplicableTo: "null",
    allotAllLeaves: 1
  }
];

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    console.log("Starting 'up' migration for employeeLeaveConfigurators data...");

    await queryInterface.sequelize.transaction(async (transaction) => {
      try {
        console.log(`Inserting ${leaveConfiguratorsData.length} records into employeeLeaveConfigurators table...`);

        await queryInterface.bulkInsert(
          'employeeLeaveConfigurators',
          leaveConfiguratorsData,
          { transaction }
        );

        console.log(`Successfully inserted ${leaveConfiguratorsData.length} records into employeeLeaveConfigurators`);
        console.log('Migration completed successfully!');
      } catch (error) {
        console.error('Error during migration:', error);
        throw error;
      }
    });
  },

  down: async (queryInterface: QueryInterface) => {
    console.log("Starting 'down' migration for employeeLeaveConfigurators data...");

    await queryInterface.sequelize.transaction(async (transaction) => {
      try {
        const leaveConfigIds = leaveConfiguratorsData.map(record => record.leaveConfigId);

        await queryInterface.bulkDelete(
          'employeeLeaveConfigurators',
          {
            leaveConfigId: leaveConfigIds,
          },
          { transaction }
        );

        console.log(`Successfully deleted ${leaveConfigIds.length} records from employeeLeaveConfigurators`);
        console.log('Rollback completed successfully!');
      } catch (error) {
        console.error('Error during rollback:', error);
        throw error;
      }
    });
  },
};
