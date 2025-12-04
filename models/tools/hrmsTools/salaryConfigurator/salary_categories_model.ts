import { DataTypes, Model, Sequelize } from "sequelize";
import { SalaryCategoriesAttributes } from "../../../../interfaces/hrmsTool/interface/hrmsInterface";

export class salaryCategories
  extends Model<SalaryCategoriesAttributes, Partial<SalaryCategoriesAttributes>> implements SalaryCategoriesAttributes
{
  declare salaryCategoryId: string;
  declare employeeType: string;
  declare employeeLocation: string;
  declare employeeLevel?: string;
  declare department?: string;
  declare yearOfStudy?: string;
  declare isDeleted?: boolean;
  declare readonly createdAt?: Date;
  declare readonly updatedAt?: Date;
}

module.exports = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  salaryCategories.init(
    {
      salaryCategoryId: {
        type: dataTypes.STRING,
        primaryKey: true,
        allowNull: false,
      },
      employeeType: {
        type: dataTypes.STRING,
        allowNull: false,
      },
      employeeLocation: {
        type: dataTypes.STRING,
        allowNull: false,
      },
      employeeLevel: {
        type: dataTypes.STRING,
        allowNull: true,
      },
      department: {
        type: dataTypes.STRING,
        allowNull: true,
      },
      yearOfStudy: {
        type: dataTypes.STRING,
        allowNull: true,
      },
      isDeleted: {
        type: dataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false,
      },
    },
    {
      sequelize,
      modelName: "salaryCategories",
      tableName: "salaryCategories",
      timestamps: true,
      createdAt: "createdAt",
      updatedAt: "updatedAt",
      indexes: [     
        // Individual column indexes for fast single-field lookups
        {
          fields: ['employeeType'],
          name: 'idx_salary_categories_employee_type'
        },
        {
          fields: ['employeeLocation'],
          name: 'idx_salary_categories_employee_location'
        },
        {
          fields: ['employeeLevel'],
          name: 'idx_salary_categories_employee_level'
        },
        {
          fields: ['department'],
          name: 'idx_salary_categories_department'
        },
        {
          fields: ['yearOfStudy'],
          name: 'idx_salary_categories_year_of_study'
        },
        {
          fields: ['isDeleted'],
          name: 'idx_salary_categories_is_deleted'
        },
        {
          fields: ['createdAt'],
          name: 'idx_salary_categories_created_at'
        },
        {
          fields: ['updatedAt'],
          name: 'idx_salary_categories_updated_at'
        },
        
        // Composite indexes for common multi-field query patterns
        {
          fields: ['employeeType', 'employeeLocation'],
          name: 'idx_salary_categories_type_location'
        },
        {
          fields: ['employeeType', 'employeeLevel'],
          name: 'idx_salary_categories_type_level'
        },
        {
          fields: ['employeeLocation', 'employeeLevel'],
          name: 'idx_salary_categories_location_level'
        },
        {
          fields: ['employeeType', 'employeeLocation', 'employeeLevel'],
          name: 'idx_salary_categories_type_location_level'
        },
        // Note: Composite indexes with all 5 fields (including department and yearOfStudy) 
        // are created manually via migration due to MySQL key length limitations
        // See migration file: add_intern_fields.sql
        {
          fields: ['employeeType', 'isDeleted'],
          name: 'idx_salary_categories_type_deleted'
        },
        {
          fields: ['employeeLocation', 'isDeleted'],
          name: 'idx_salary_categories_location_deleted'
        },
        {
          fields: ['employeeLevel', 'isDeleted'],
          name: 'idx_salary_categories_level_deleted'
        },
        {
          fields: ['employeeType', 'employeeLocation', 'isDeleted'],
          name: 'idx_salary_categories_type_location_deleted'
        },
        {
          fields: ['createdAt', 'isDeleted'],
          name: 'idx_salary_categories_created_deleted'
        },
        {
          fields: ['updatedAt', 'isDeleted'],
          name: 'idx_salary_categories_updated_deleted'
        }
      ]
    }
  );
  
  return salaryCategories;
};
