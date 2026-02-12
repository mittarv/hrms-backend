'use strict';

import { QueryInterface } from "sequelize";

const leaveConfiguratorsData = [
  {
    leaveConfigId: "4cef5128-4756-4778-bd8b-f7ab0d12085d",
    leaveType: "Casual",
    employeeType: "[\"fte_key\",\"pte_key\",\"contractor_key\",\"intern_key\",\"consultant_key\",\"ofte_key\",\"extended_intern_key\"]",
    accuralFrequency: "3",
    totalAllotedLeaves: 15,
    accuralRate: 3.75,
    minimumNoticePeriod: 14,
    maximumNoticePeriod: 0,
    continuousLeavesLimit: 15,
    excludePaidWeekend: false,
    appliedGender: "[\"female_key\",\"male_key\"]",
    isHalfDayAllowed: true,
    isProofRequired: false,
    isReasonRequired: true,
    effectiveDate: new Date("2025-10-13T10:19:57.000Z"),
    terminationDate: null,
    isActive: true,
    createdAt: new Date("2025-10-13T10:19:57.000Z"),
    updatedAt: new Date("2026-02-12T09:43:19.347Z"),
    isDefault: true,
    leaveApplicableTo: "null",
    allotAllLeaves: true
  },
  {
    leaveConfigId: "db48e78c-5a8e-46fb-a6f9-e47c0e5ea101",
    leaveType: "Comp Off",
    employeeType: "[\"fte_key\",\"pte_key\",\"ofte_key\",\"intern_key\",\"consultant_key\",\"contractor_key\",\"extended_intern_key\"]",
    accuralFrequency: "1",
    totalAllotedLeaves: 0,
    accuralRate: 0,
    minimumNoticePeriod: 10,
    maximumNoticePeriod: 10,
    continuousLeavesLimit: 5,
    excludePaidWeekend: true,
    appliedGender: "[\"male_key\",\"female_key\"]",
    isHalfDayAllowed: true,
    isProofRequired: true,
    isReasonRequired: true,
    effectiveDate: new Date("2025-12-16T05:51:19.000Z"),
    terminationDate: null,
    isActive: true,
    createdAt: new Date("2025-12-16T05:51:19.000Z"),
    updatedAt: new Date("2026-02-12T09:42:05.596Z"),
    isDefault: true,
    leaveApplicableTo: "null",
    allotAllLeaves: true
  },
  {
    leaveConfigId: "45467caf-daf8-472a-873f-f8dc479445a9",
    leaveType: "Optional",
    employeeType: "[\"fte_key\",\"pte_key\",\"intern_key\",\"contractor_key\",\"consultant_key\",\"ofte_key\",\"extended_intern_key\"]",
    accuralFrequency: "2",
    totalAllotedLeaves: 12,
    accuralRate: 2,
    minimumNoticePeriod: 14,
    maximumNoticePeriod: 0,
    continuousLeavesLimit: 5,
    excludePaidWeekend: false,
    appliedGender: "[\"male_key\",\"female_key\",\"other_key\"]",
    isHalfDayAllowed: true,
    isProofRequired: false,
    isReasonRequired: true,
    effectiveDate: new Date("2025-10-13T10:19:57.000Z"),
    terminationDate: null,
    isActive: true,
    createdAt: new Date("2025-10-13T10:19:57.000Z"),
    updatedAt: new Date("2026-02-12T09:41:55.664Z"),
    isDefault: true,
    leaveApplicableTo: "null",
    allotAllLeaves: true
  },
  {
    leaveConfigId: "63847a1e-1ef9-4ef3-a6a1-86b6f0eb8bd1",
    leaveType: "Sick",
    employeeType: "[\"fte_key\",\"pte_key\",\"contractor_key\",\"intern_key\",\"consultant_key\",\"ofte_key\",\"extended_intern_key\"]",
    accuralFrequency: "4",
    totalAllotedLeaves: 15,
    accuralRate: 5,
    minimumNoticePeriod: 0,
    maximumNoticePeriod: 3,
    continuousLeavesLimit: 2,
    excludePaidWeekend: false,
    appliedGender: "[\"male_key\",\"female_key\",\"other_key\"]",
    isHalfDayAllowed: false,
    isProofRequired: true,
    isReasonRequired: true,
    effectiveDate: new Date("2025-10-13T10:19:57.000Z"),
    terminationDate: null,
    isActive: true,
    createdAt: new Date("2025-10-13T10:19:57.000Z"),
    updatedAt: new Date("2026-02-12T09:42:27.325Z"),
    isDefault: true,
    leaveApplicableTo: "null",
    allotAllLeaves: false
  },
  {
    leaveConfigId: "dc9fe583-2904-4b7e-b639-e33462743278",
    leaveType: "Unpaid",
    employeeType: "[\"fte_key\",\"pte_key\",\"contractor_key\",\"intern_key\",\"consultant_key\",\"ofte_key\",\"extended_intern_key\"]",
    accuralFrequency: "6",
    totalAllotedLeaves: 90,
    accuralRate: 45,
    minimumNoticePeriod: 0,
    maximumNoticePeriod: 0,
    continuousLeavesLimit: 7,
    excludePaidWeekend: false,
    appliedGender: "[\"female_key\",\"other_key\",\"male_key\"]",
    isHalfDayAllowed: false,
    isProofRequired: false,
    isReasonRequired: true,
    effectiveDate: new Date("2025-10-13T10:19:57.000Z"),
    terminationDate: null,
    isActive: true,
    createdAt: new Date("2025-10-13T10:19:57.000Z"),
    updatedAt: new Date("2026-02-12T09:43:05.794Z"),
    isDefault: true,
    leaveApplicableTo: "null",
    allotAllLeaves: true
  }
];

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    console.log("Starting 'up' migration for employeeleaveconfigurators data...");

    await queryInterface.sequelize.transaction(async (transaction) => {
      try {
        console.log(`Inserting ${leaveConfiguratorsData.length} records into employeeleaveconfigurators table...`);

        await queryInterface.bulkInsert(
          'employeeleaveconfigurators',
          leaveConfiguratorsData,
          { transaction }
        );

        console.log(`Successfully inserted ${leaveConfiguratorsData.length} records into employeeleaveconfigurators`);
        console.log('Migration completed successfully!');
      } catch (error) {
        console.error('Error during migration:', error);
        throw error;
      }
    });
  },

  down: async (queryInterface: QueryInterface) => {
    console.log("Starting 'down' migration for employeeleaveconfigurators data...");

    await queryInterface.sequelize.transaction(async (transaction) => {
      try {
        const leaveConfigIds = leaveConfiguratorsData.map(record => record.leaveConfigId);

        await queryInterface.bulkDelete(
          'employeeleaveconfigurators',
          {
            leaveConfigId: leaveConfigIds,
          },
          { transaction }
        );

        console.log(`Successfully deleted ${leaveConfigIds.length} records from employeeleaveconfigurators`);
        console.log('Rollback completed successfully!');
      } catch (error) {
        console.error('Error during rollback:', error);
        throw error;
      }
    });
  },
};
