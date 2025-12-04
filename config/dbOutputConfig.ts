import { getEnv,DbConfig } from "../interfaces/configInterfaces/interfaces/configinterface";
const dbOutputConfig: DbConfig = {
  HOST: getEnv("DATABASE_OUTPUT_HOST"),
  USER: getEnv("DATABASE_OUTPUT_USER"),
  PASSWORD: getEnv("DATABASE_OUTPUT_PASSWORD"),
  DB: getEnv("DATABASE_OUTPUT_NAME"),
  dialect: getEnv("DATABASE_OUTPUT_DIALECT"),
  pool: {
    max: 40,
    min: 0,
    acquire: 60000,
    idle: 10000,
  },
};

export = dbOutputConfig;

