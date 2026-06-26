import { DataTypes, Model, Sequelize } from "sequelize";
import { PhaseAuditLogAttributes } from "../../../../interfaces/hrmsTool/interface/rewardsInterface";
import {
  PhaseAuditPhaseName,
  PhaseAuditAction,
} from "../../../../interfaces/hrmsTool/enum/rewardsEnum";

export class PhaseAuditLog
  extends Model<PhaseAuditLogAttributes>
  implements PhaseAuditLogAttributes {
  declare id: string;
  declare cycleId: string;
  declare phaseName: PhaseAuditPhaseName;
  declare action: PhaseAuditAction;
  declare triggeredByEmpUuid: string;
  declare readonly createdAt?: Date;
}

export const initPhaseAuditLog = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  PhaseAuditLog.init(
    {
      id: {
        type: dataTypes.UUID,
        primaryKey: true,
        defaultValue: dataTypes.UUIDV4,
      },
      cycleId: {
        type: dataTypes.UUID,
        allowNull: false,
      },
      phaseName: {
        type: dataTypes.ENUM,
        values: Object.values(PhaseAuditPhaseName),
        allowNull: false,
      },
      action: {
        type: dataTypes.ENUM,
        values: Object.values(PhaseAuditAction),
        allowNull: false,
      },
      triggeredByEmpUuid: {
        type: dataTypes.UUID,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "phaseAuditLog",
      tableName: "phase_audit_log",
      timestamps: true,
      createdAt: "createdAt",
      updatedAt: false,
      indexes: [{ fields: ["cycleId"] }],
    }
  );
  return PhaseAuditLog;
};
