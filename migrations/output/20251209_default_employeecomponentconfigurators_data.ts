'use strict';

import { QueryInterface } from "sequelize";

const componentConfiguratorsData = [
  {
    id: 1,
    componentType: "emp_type_dropdown",
    componentValue: "{\"fte_key\": \"FTE\", \"pte_key\": \"PTE\", \"ofte_key\": \"OFTE\", \"intern_key\": \"Intern\", \"consultant_key\": \"Consultant\", \"contractor_key\": \"Contractor\", \"extended_intern_key\": \"Extended Intern\"}",
    isDeleted: false,
    createdAt: new Date("2025-01-09T07:01:42.000Z"),
    updatedAt: new Date("2025-01-09T07:01:42.000Z")
  },
  {
    id: 2,
    componentType: "department_type_dropdown",
    componentValue: "{\"cdm_key\": \"CDM\", \"sde_key\": \"Software Engineering\", \"half_key\": \"HALF\", \"design_key\": \"Design\", \"product_key\": \"Product Management\", \"project_key\": \"Project Management\", \"graphics_key\": \"Graphics\", \"analytics_key\": \"Analytics\", \"leadership_key\": \"Leadership\", \"it_security_key\": \"IT Security\", \"business_dev_key\": \"Business Dev\"}",
    isDeleted: false,
    createdAt: new Date("2025-01-09T07:01:42.000Z"),
    updatedAt: new Date("2025-01-09T07:01:42.000Z")
  },
  {
    id: 3,
    componentType: "gender_type_dropdown",
    componentValue: "{\"male_key\":\"Male\",\"female_key\":\"Female\",\"other_key\":\"Other\"}",
    isDeleted: false,
    createdAt: new Date("2025-01-09T07:01:42.000Z"),
    updatedAt: new Date("2025-01-09T07:01:42.000Z")
  },
  {
    id: 4,
    componentType: "blood_group_dropdown",
    componentValue: "{\"0\":\"A+\",\"1\":\"A-\",\"2\":\"B+\",\"3\":\"B-\",\"4\":\"AB+\",\"5\":\"AB-\",\"6\":\"O+\",\"7\":\"O-\"}",
    isDeleted: false,
    createdAt: new Date("2025-01-09T07:01:42.000Z"),
    updatedAt: new Date("2025-01-09T07:01:42.000Z")
  },
  {
    id: 5,
    componentType: "emergency_contact_relation_dropdown",
    componentValue: "{\"0\":\"Parent\",\"1\":\"Spouse\",\"2\":\"Friend\"}",
    isDeleted: false,
    createdAt: new Date("2025-01-09T07:01:42.000Z"),
    updatedAt: new Date("2025-01-09T07:01:42.000Z")
  },
  {
    id: 6,
    componentType: "marital_status_dropdown",
    componentValue: "{\"0\":\"Single\",\"1\":\"Married\"}",
    isDeleted: false,
    createdAt: new Date("2025-01-09T07:01:42.000Z"),
    updatedAt: new Date("2025-01-09T07:01:42.000Z")
  },
  {
    id: 7,
    componentType: "total_leaves_dropdown",
    componentValue: "{\"sick_leave\":10,\"casual_leave\":12,\"bereavement_leave\":5}",
    isDeleted: false,
    createdAt: new Date("2025-01-09T07:01:42.000Z"),
    updatedAt: new Date("2025-01-09T07:01:42.000Z")
  },
  {
    id: 8,
    componentType: "leave_accural_frequency",
    componentValue: "{\"monthly_key\":[\"Monthly\",\"12\"],\"quarterly_key\":[\"Quarterly\",\"4\"],\"half_yearly_key\":[\"Half-Yearly\",\"2\"],\"annually_key\":[\"Annually\",\"1\"],\"one_time_key\":[\"One Time\",\"0\"]}",
    isDeleted: false,
    createdAt: new Date("2025-01-16T13:16:00.000Z"),
    updatedAt: new Date("2025-09-12T05:31:50.000Z")
  },
  {
    id: 9,
    componentType: "status",
    componentValue: "{\"active_key\":\"Active\",\"inactive_key\":\"Inactive\"}",
    isDeleted: false,
    createdAt: new Date("2025-01-16T13:16:00.000Z"),
    updatedAt: new Date("2025-01-16T13:16:00.000Z")
  },
  {
    id: 10,
    componentType: "level_dropdown",
    componentValue: "{\"0\": \"Level G\", \"1\": \"Level G+\", \"2\": \"Level H\", \"3\": \"Level H+\", \"4\": \"Level H++\", \"5\": \"Level J\", \"6\": \"Level J+\", \"7\": \"Level J++\", \"8\": \"Level K\", \"9\": \"Level K+\", \"10\": \"Level K++\", \"11\": \"Level L\", \"12\": \"Level L+\", \"13\": \"Level L++\", \"14\": \"Level M\", \"15\": \"Level 1\", \"16\": \"Level 2\", \"17\": \"Level 3\", \"18\": \"Trainee\", \"19\": \"Intern\"}",
    isDeleted: false,
    createdAt: new Date("2025-02-28T07:47:04.000Z"),
    updatedAt: new Date("2025-10-03T11:26:37.000Z")
  },
  {
    id: 11,
    componentType: "location_dropdown",
    componentValue: "{\"hybrid_key\": \"Hybrid\", \"remote_key\": \"Remote\", \"on_site_key\": \"On Site\", \"hybrid_hyderabad_key\": \"Hybrid- Hyderabad\", \"hybrid_relocated_key\": \"Hybrid- Relocated\", \"onsite_hyderabad_key\": \"On Site- Hyderabad\", \"onsite_relocated_key\": \"On Site- Relocated\"}",
    isDeleted: false,
    createdAt: new Date("2025-02-28T07:47:04.000Z"),
    updatedAt: new Date("2025-02-28T07:47:04.000Z")
  },
  {
    id: 12,
    componentType: "year_of_study",
    componentValue: "{\"0\":\"1st\",\"1\":\"2nd\",\"2\":\"3rd\",\"3\":\"4th\",\"4\":\"N/A\"}",
    isDeleted: false,
    createdAt: new Date("2025-10-03T11:24:51.000Z"),
    updatedAt: new Date("2025-10-03T11:24:51.000Z")
  }
];

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    console.log("Starting 'up' migration for employeecomponentconfigurators data...");

    await queryInterface.sequelize.transaction(async (transaction) => {
      try {
        console.log(`Inserting ${componentConfiguratorsData.length} records into employeecomponentconfigurators table...`);

        await queryInterface.bulkInsert(
          'employeecomponentconfigurators',
          componentConfiguratorsData,
          { transaction }
        );

        console.log(`Successfully inserted ${componentConfiguratorsData.length} records into employeecomponentconfigurators`);
        console.log('Migration completed successfully!');
      } catch (error) {
        console.error('Error during migration:', error);
        throw error;
      }
    });
  },

  down: async (queryInterface: QueryInterface) => {
    console.log("Starting 'down' migration for employeecomponentconfigurators data...");

    await queryInterface.sequelize.transaction(async (transaction) => {
      try {
        const ids = componentConfiguratorsData.map(record => record.id);

        await queryInterface.bulkDelete(
          'employeecomponentconfigurators',
          {
            id: ids,
          },
          { transaction }
        );

        console.log(`Successfully deleted ${ids.length} records from employeecomponentconfigurators`);
        console.log('Rollback completed successfully!');
      } catch (error) {
        console.error('Error during rollback:', error);
        throw error;
      }
    });
  },
};