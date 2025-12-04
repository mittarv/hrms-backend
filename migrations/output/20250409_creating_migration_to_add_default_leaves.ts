'use strict';

import { QueryInterface, Op } from 'sequelize';
const { createUUIDV4 } = require('../utilities/uuidV4Generator');

module.exports = {
  async up(queryInterface: QueryInterface): Promise<void> {
    console.log('Started migration: Adding default leaves to employeeLeaveConfigurators table');
    await queryInterface.bulkInsert('employeeLeaveConfigurators', [
      // 1. Sick Leave
      {
        leaveConfigId: await createUUIDV4(),
        leaveType: "Sick",
        isProofRequired: true,
        isReasonRequired: true,
        isHalfDayAllowed: false,
        excludePaidWeekend: false,
        employeeType: "[\"fte_key\",\"pte_key\",\"contractor_key\",\"intern_key\",\"consultant_key\"]",
        appliedGender: "[\"male_key\",\"female_key\",\"other_key\"]",
        minimumNoticePeriod: 0,
        maximumNoticePeriod: 3,
        totalAllotedLeaves: 10,
        continuousLeavesLimit: 3,
        accuralFrequency: "monthly_key",
        accuralRate: 0.83,
        isActive: true,
        leaveApplicableTo: JSON.stringify({
          "fte_key": {
            "value": 2,
            "unit": "Days"
          },
          "pte_key": {
            "value": 1,
            "unit": "Months"
          },
          "contractor_key": {
            "value": 30,
            "unit": "Days"
          },
          "intern_key": {
            "value": 1,
            "unit": "Months"
          },
          "consultant_key": {
            "value": 2,
            "unit": "Weeks"
          }
        }),
        isDefault: true,
        effectiveDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      // 2. Casual Leave
      {
        leaveConfigId: await createUUIDV4(),
        leaveType: "Casual",
        isProofRequired: false,
        isReasonRequired: true,
        isHalfDayAllowed: true,
        excludePaidWeekend: false,
        employeeType: "[\"fte_key\",\"pte_key\",\"contractor_key\",\"intern_key\",\"consultant_key\"]",
        appliedGender: "[\"male_key\",\"female_key\",\"other_key\"]",
        minimumNoticePeriod: 14,
        maximumNoticePeriod: 0,
        totalAllotedLeaves: 15,
        continuousLeavesLimit: 15,
        accuralFrequency: "monthly_key",
        accuralRate: 1.25,
        isActive: true,
        leaveApplicableTo: JSON.stringify({
          "fte_key": {
            "value": 2,
            "unit": "Days"
          },
          "pte_key": {
            "value": 30,
            "unit": "Days"
          },
          "contractor_key": {
            "value": 2,
            "unit": "Months"
          },
          "intern_key": {
            "value": 2,
            "unit": "Weeks"
          },
          "consultant_key": {
            "value": 1,
            "unit": "Months"
          }
        }),
        isDefault: true,
        effectiveDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      // 3. Optional Leave
      {
        leaveConfigId: await createUUIDV4(),
        leaveType: "Optional",
        isProofRequired: false,
        isReasonRequired: true,
        isHalfDayAllowed: true,
        excludePaidWeekend: false,
        employeeType: "[\"fte_key\",\"pte_key\",\"intern_key\",\"contractor_key\",\"consultant_key\"]",
        appliedGender: "[\"male_key\",\"female_key\",\"other_key\"]",
        minimumNoticePeriod: 14,
        maximumNoticePeriod: 0,
        totalAllotedLeaves: 12,
        continuousLeavesLimit: 5,
        accuralFrequency: "monthly_key",
        accuralRate: 1,
        isActive: true,
        leaveApplicableTo: null,
        isDefault: true,
        effectiveDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      // 4. Unpaid Leave
      {
        leaveConfigId: await createUUIDV4(),
        leaveType: "Unpaid",
        isProofRequired: false,
        isReasonRequired: true,
        isHalfDayAllowed: false,
        excludePaidWeekend: false,
        employeeType: "[\"fte_key\",\"pte_key\",\"contractor_key\",\"intern_key\",\"consultant_key\"]",
        appliedGender: "[\"female_key\",\"other_key\",\"male_key\"]",
        minimumNoticePeriod: 0,
        maximumNoticePeriod: 0,
        totalAllotedLeaves: 90,
        continuousLeavesLimit: 7,
        accuralFrequency: "monthly_key",
        accuralRate: 0,
        isActive: true,
        leaveApplicableTo: null,
        isDefault: true,
        effectiveDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    ]);
    console.log('Completed migration: Default leaves added to employeeLeaveConfigurators table');
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    console.log('Started rollback: Removing default leaves from employeeLeaveConfigurators table');
    await queryInterface.bulkDelete('employeeLeaveConfigurators', {
      leaveType: {
        [Op.in]: ['Sick', 'Casual', 'Optional', 'Unpaid']
      }
    }, {});
    console.log('Completed rollback: Default leaves removed from employeeLeaveConfigurators table');
  }
};