import { DataTypes, Model, Sequelize } from "sequelize";
import {
  hrmsEmailLogsAttributes,
  hrmsEmailLogsCreationAttributes,
} from "../../../interfaces/hrmsTool/interface/hrmsInterface";

export class hrmsEmailLogs
  extends Model<hrmsEmailLogsAttributes, hrmsEmailLogsCreationAttributes>
  implements hrmsEmailLogsAttributes
{
  public email_log_id!: string;
  public recipient_employee_id?: string;
  public recipient_email!: string;
  public sender_email!: string;
  public subject!: string;
  public sent_at!: Date;

  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;
}

module.exports = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  hrmsEmailLogs.init(
    {
      email_log_id: {
        type: dataTypes.STRING,
        primaryKey: true,
        allowNull: false,
      },
      recipient_employee_id: {
        type: dataTypes.STRING,
        allowNull: true,
        // references: {
        //   model: "employeebasicdetails",
        //   key: "empUuid",
        // },
      },
      recipient_email: {
        type: dataTypes.STRING,
        allowNull: false,
      },
      sender_email: {
        type: dataTypes.STRING,
        allowNull: false,
      },
      subject: {
        type: dataTypes.STRING,
        allowNull: false,
      },
      sent_at: {
        type: dataTypes.DATE,
        allowNull: false,
        defaultValue: dataTypes.NOW,
      },
    },
    {
      sequelize,
      modelName: "hrmsEmailLogs",
      tableName: "hrmsEmailLogs",
      timestamps: true,
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    }
  );
  return hrmsEmailLogs;
};
