import { getEnv,DbConfig } from "../interfaces/configInterfaces/interfaces/configinterface";
const dbConfig: DbConfig = {
  HOST: getEnv("DATABASE_HOST"),
  USER: getEnv("DATABASE_USER"),
  PASSWORD: getEnv("DATABASE_PASSWORD"),
  DB: getEnv("DATABASE_NAME"),
  dialect: getEnv("DATABASE_DIALECT"),
  pool: {
    max: 40,
    min: 0,
    acquire: 60000,
    idle: 10000,
  },
};

export = dbConfig;
