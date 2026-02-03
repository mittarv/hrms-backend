import { getEnv,SequelizeConfig} from "../interfaces/configInterfaces/interfaces/configinterface";
const sequelizeConfig: SequelizeConfig = {
  output: {
    database: getEnv("DATABASE_OUTPUT_NAME"),
    username: getEnv("DATABASE_OUTPUT_USER"),
    password: getEnv("DATABASE_OUTPUT_PASSWORD"),
    dialect: getEnv("DATABASE_OUTPUT_DIALECT"),
    host: getEnv("DATABASE_OUTPUT_HOST"),
    port: parseInt(getEnv("DATABASE_OUTPUT_PORT") || "3306", 10),
    migrationStorageTableName: 'sequelizemeta',
  }
};

export = sequelizeConfig;