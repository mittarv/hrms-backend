import { getEnv,SequelizeConfig} from "../interfaces/configInterfaces/interfaces/configinterface";
const sequelizeConfig: SequelizeConfig = {
  main: {
    database: getEnv("DATABASE_NAME"),
    username: getEnv("DATABASE_USER"),
    password: getEnv("DATABASE_PASSWORD"),
    dialect: getEnv("DATABASE_DIALECT"),
    host: getEnv("DATABASE_HOST"),
    port: 3306,
    migrationStorageTableName: 'sequelizemeta',
  },
  output: {
    database: getEnv("DATABASE_OUTPUT_NAME"),
    username: getEnv("DATABASE_OUTPUT_USER"),
    password: getEnv("DATABASE_OUTPUT_PASSWORD"),
    dialect: getEnv("DATABASE_OUTPUT_DIALECT"),
    host: getEnv("DATABASE_OUTPUT_HOST"),
    port: 3306,
    migrationStorageTableName: 'sequelizemeta',
  },
  payments: {
    database: getEnv("DATABASE_PAYMENTS_NAME"),
    username: getEnv("DATABASE_PAYMENTS_USER"),
    password: getEnv("DATABASE_PAYMENTS_PASSWORD"),
    dialect: getEnv("DATABASE_PAYMENTS_DIALECT"),
    host: getEnv("DATABASE_PAYMENTS_HOST"),
    port: 3306,
    migrationStorageTableName: 'sequelizemeta',
  },
};

export = sequelizeConfig;