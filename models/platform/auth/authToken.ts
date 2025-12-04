import { DataTypes, Model, Sequelize } from "sequelize";
import { AuthTokenAttributes } from "../../../interfaces/platformInterfaces/interfaces/authInterface"; 

export class AuthToken
  extends Model<AuthTokenAttributes, Partial<AuthTokenAttributes>>
  implements AuthTokenAttributes {
  declare id: number;
  declare token: string;
  declare expiresAt: Date;
  declare refreshTokenId: number;
  declare userId: number;
  declare lastUsed?: Date | null;
  declare isDeleted?: boolean;

  declare readonly createdAt?: Date;
  declare readonly updatedAt?: Date;
}

module.exports = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  AuthToken.init(
    {
      id: {
        type: dataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
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
      refreshTokenId: {
        type: dataTypes.BIGINT,
        allowNull: false,
      },
      userId: {
        type: dataTypes.INTEGER,
        allowNull: false,
      },
      lastUsed: {
        type: dataTypes.DATE,
        allowNull: true,
      },
      isDeleted: {
        type: dataTypes.BOOLEAN,
        defaultValue: false,
      },
    },
    {
      sequelize,
      tableName: "authTokens",
      timestamps: true,
      indexes: [
        {
          name: "idx_auth_token_lookup",
          fields: ["token", "isDeleted", "userId", "expiresAt"],
        },
        {
          name: "idx_refresh_token_cleanup",
          fields: ["refreshTokenId", "isDeleted"],
        },
        {
          name: "idx_auth_token_user",
          fields: ["userId", "isDeleted"],
        },
      ],
    }
  );

  return AuthToken;
};
