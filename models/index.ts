import { Sequelize, DataTypes, Dialect } from "sequelize";
import dbOutputConfig from "../config/dbOutputConfig";
import { initializeHrmsModels } from "./hrms.models";
import { setupHrmsAssociations } from "../associations/hrmsAssociations";
import { setUamAssociations } from "../associations/uamToolAssociations";

interface DB {
  Sequelize: typeof Sequelize;
  sequelize: Sequelize;
  [key: string]: any;
}

let isTestEnv = false;
if (process.env.NODE_ENV === "DEVELOPMENT") {
  isTestEnv = false;
}

// Creating the output database
const outputSequelize = new Sequelize(
  dbOutputConfig.DB,
  dbOutputConfig.USER,
  dbOutputConfig.PASSWORD,
  {
    host: dbOutputConfig.HOST,
    port: dbOutputConfig.PORT,
    dialect: dbOutputConfig.dialect as Dialect,
    logging: isTestEnv,
    pool: {
      max: dbOutputConfig.pool.max,
      min: dbOutputConfig.pool.min,
      acquire: dbOutputConfig.pool.acquire,
      idle: dbOutputConfig.pool.idle,
    },
  }
);

outputSequelize
  .authenticate()
  .then(() => {
    console.log("output database connected successfully");
  })
  .catch((err) => {
    console.log("Report Error : " + err);
  });

const dbOutput: DB = {} as DB;
dbOutput.Sequelize = Sequelize;
dbOutput.sequelize = outputSequelize;

// ==================================== HRMS Tools Models ================================================================
initializeHrmsModels(dbOutput, outputSequelize, DataTypes);

dbOutput.sequelize
  .sync({ force: false, alter: false })
  .then(() => {
    console.log("report model sync completed");
  })
  .catch((err) => {
    console.log(err);
  });

// UAM tool relatons
setUamAssociations();

//=================================HRMS Tool related associations==================================================
setupHrmsAssociations();

const sequelize = outputSequelize;

export { dbOutput, outputSequelize, sequelize };