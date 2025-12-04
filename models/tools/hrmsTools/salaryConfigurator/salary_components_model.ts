import { DataTypes, Model, Sequelize } from "sequelize";
import { salaryComponentsAttributes } from "../../../../interfaces/hrmsTool/interface/hrmsInterface";
import { componentTypes, LeaveAccrualFrequency } from "../../../../interfaces/hrmsTool/enum/hrmsEnum";

export class salaryComponents
  extends Model<salaryComponentsAttributes, Partial<salaryComponentsAttributes>>
  implements salaryComponentsAttributes
{
  declare componentId: string;
  declare salaryCategoryId: string;
  declare componentName: string;
  declare componentType: string;
  declare amount: number;
  declare percentageOfBasicSalary?: number;
  declare thresholdAmount?: number;
  declare frequency?: string;
  declare isVariable?: boolean;
  declare includeinLop?: boolean;
  declare effectiveFrom?: Date;
  declare effectiveTill?: Date;
  declare isDeleted?: boolean;
  declare isDefault?: boolean;
  declare createdBy: string;
  declare updatedBy: string;
  declare readonly createdAt?: Date;
  declare readonly updatedAt?: Date;
}

module.exports = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  salaryComponents.init(
    {
      componentId: {
        type: dataTypes.STRING,
        primaryKey: true,
        allowNull: false,
      },
      salaryCategoryId: {
        type: dataTypes.STRING,
        references: {
                model: 'salaryCategories',
                key: 'salaryCategoryId'
        },
        allowNull: false,
        onUpdate: 'CASCADE', 
        onDelete: 'RESTRICT'
      },
      componentName: {
        type: dataTypes.STRING,
        allowNull: false,
      },
      componentType: {
        type: dataTypes.ENUM,
        values: Object.values(componentTypes),
        allowNull: false,
        validate: {
          isIn: {
            args: [Object.values(componentTypes)],
            msg: "Invalid component type"
          }
        }
      },
      amount: {
        type: dataTypes.FLOAT,
        allowNull: false,
      },
      percentageOfBasicSalary: {
        type: dataTypes.DOUBLE,
        allowNull: true,
      },
      thresholdAmount: {
        type: dataTypes.FLOAT,
        allowNull: true,
      },
      frequency: {
        type: dataTypes.ENUM,
        values: Object.values(LeaveAccrualFrequency),
        allowNull: true,
        validate: {
          isIn: {
            args: [Object.values(LeaveAccrualFrequency)],
            msg: "Invalid frequency"
          }
        }
      },
      isVariable: {
        type: dataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false,
      },
      includeinLop:{
        type: dataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false,
      },
      isDeleted: {
        type: dataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      isDefault: {
        type: dataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      createdBy: {
        type: dataTypes.STRING,
        allowNull: false,
      },
      updatedBy: {
        type: dataTypes.STRING,
        allowNull: false,
      },
      effectiveFrom: {
        type: dataTypes.DATE,
        allowNull: true,
      },
      effectiveTill: {
        type: dataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "salary_components",
      tableName: "salary_components",
      timestamps: true,
      createdAt: "createdAt",
      updatedAt: "updatedAt",
      indexes: [  
        // Foreign key indexes
        {
          fields: ['salaryCategoryId'],
          name: 'idx_salary_components_category_id'
        },
        
        // Individual column indexes for fast lookups
        {
          fields: ['componentName'],
          name: 'idx_salary_components_name'
        },
        {
          fields: ['componentType'],
          name: 'idx_salary_components_type'
        },
        {
          fields: ['amount'],
          name: 'idx_salary_components_amount'
        },
        {
          fields: ['thresholdAmount'],
          name: 'idx_salary_components_threshold_amount'
        },
        {
          fields: ['frequency'],
          name: 'idx_salary_components_frequency'
        },
        {
          fields: ['isVariable'],
          name: 'idx_salary_components_is_variable'
        },
        {
          fields: ['effectiveFrom'],
          name: 'idx_salary_components_effective_from'
        },
        {
          fields: ['effectiveTill'],
          name: 'idx_salary_components_effective_till'
        },
        {
          fields: ['isDeleted'],
          name: 'idx_salary_components_is_deleted'
        },
        {
          fields: ['createdBy'],
          name: 'idx_salary_components_created_by'
        },
        {
          fields: ['updatedBy'],
          name: 'idx_salary_components_updated_by'
        },
        {
          fields: ['createdAt'],
          name: 'idx_salary_components_created_at'
        },
        {
          fields: ['updatedAt'],
          name: 'idx_salary_components_updated_at'
        },
        
        // Composite indexes for common query patterns
        {
          fields: ['salaryCategoryId', 'componentType'],
          name: 'idx_salary_components_category_type'
        },
        {
          fields: ['salaryCategoryId', 'isDeleted'],
          name: 'idx_salary_components_category_deleted'
        },
        {
          fields: ['componentType', 'isDeleted'],
          name: 'idx_salary_components_type_deleted'
        },  
        {
          fields: ['effectiveFrom', 'effectiveTill'],
          name: 'idx_salary_components_effective_dates'
        },
        {
          fields: ['effectiveFrom', 'isDeleted'],
          name: 'idx_salary_components_effective_from_deleted'
        },
        {
          fields: ['frequency', 'componentType'],
          name: 'idx_salary_components_frequency_type'
        },
        {
          fields: ['amount', 'componentType'],
          name: 'idx_salary_components_amount_type'
        },
        {
          fields: ['salaryCategoryId', 'effectiveFrom', 'effectiveTill'],
          name: 'idx_salary_components_category_dates'
        },
        {
          fields: ['componentName', 'isDeleted'],
          name: 'idx_salary_components_name_deleted'
        },
        {
          fields: ['createdBy', 'createdAt'],
          name: 'idx_salary_components_created_audit'
        },
        {
          fields: ['updatedBy', 'updatedAt'],
          name: 'idx_salary_components_updated_audit'
        }
      ]
    }
  );
  
  return salaryComponents;
};
