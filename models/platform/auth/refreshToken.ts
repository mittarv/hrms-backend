import { DataTypes, Model, Sequelize } from "sequelize";
import { RefreshTokenAttributes } from "../../../interfaces/platformInterfaces/interfaces/authInterface";

export class RefreshToken
  extends Model<RefreshTokenAttributes, Partial<RefreshTokenAttributes>>
  implements RefreshTokenAttributes {
  declare id: number;
  declare token: string;
  declare expiresAt: Date;
  declare userAgent: string;
  declare deviceToken?: string;
  declare deviceName?: string | null;
  declare lastUsed?: Date | null;
  declare refreshCount: number;
  declare isDeleted?: boolean;
  declare userId: number;

  declare readonly createdAt?: Date;
  declare readonly updatedAt?: Date;
}

module.exports = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  RefreshToken.init(
    {
      id: {
        type: dataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },
      token: {
        type: dataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
      expiresAt: {
        type: dataTypes.DATE,
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
      userAgent: {
        type: dataTypes.STRING,
        allowNull: false,
      },
      deviceToken: {
        type: dataTypes.STRING,
        allowNull: true,
      },
      deviceName: {
        type: dataTypes.STRING,
        allowNull: true,
      },
      lastUsed: {
        type: dataTypes.DATE,
        allowNull: true,
      },
      refreshCount: {
        type: dataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      isDeleted: {
        type: dataTypes.BOOLEAN,
        defaultValue: false,
      },
      userId: {
        type: dataTypes.INTEGER,
        allowNull: false,
      },
    },
    {
      sequelize,
      tableName: "refreshTokens",
      timestamps: true,
      indexes: [
        {
          name: "idx_refresh_token_lookup",
          fields: ["token", "isDeleted", "userId"],
          unique: true,
        },
        {
          fields: ["expiresAt"],
          name: "idx_refresh_tokens_expires_at",
        },
        {
          fields: ["userId", "isDeleted"],
          name: "idx_refresh_tokens_user_active",
        },
        {
          fields: ["deviceToken", "userId"],
          name: "idx_refresh_tokens_device_user",
        },
      ],
    }
  );

  return RefreshToken;
};
