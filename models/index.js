const { Sequelize, DataTypes} = require("sequelize");
const dbConfig = require("../config/dbConfig");
const dbOutputConfig = require("../config/dbOutputConfig");
import { setupHrmsAssociations } from "../associations/hrmsAssociations";
import { setUamAssociations } from "../associations/uamToolAssociations";

let isTestEnv = false;
if (process.env.NODE_ENV === "DEVELOPMENT") {
  isTestEnv = false;
}
const sequelize = new Sequelize(dbConfig.DB, dbConfig.USER, dbConfig.PASSWORD, {
  host: dbConfig.HOST,
  dialect: dbConfig.dialect,
  operatorsAliases: false,
  logging: isTestEnv,
  pool: {
    max: dbConfig.pool.max,
    min: dbConfig.pool.min,
    acquire: dbConfig.pool.acquire,
    idle: dbConfig.pool.idle,
  },
});


// Creating the output database
const outputSequelize = new Sequelize(
  dbOutputConfig.DB,
  dbOutputConfig.USER,
  dbOutputConfig.PASSWORD,
  {
    host: dbOutputConfig.HOST,
    dialect: dbOutputConfig.dialect,
    operatorsAliases: false,
    logging: isTestEnv,
    pool: {
      max: dbOutputConfig.pool.max,
      min: dbOutputConfig.pool.min,
      acquire: dbOutputConfig.pool.acquire,
      idle: dbOutputConfig.pool.idle,
    },
  }
);

//checking connection
sequelize
  .authenticate()
  .then(() => {
    console.log("connected successfully");
  })
  .catch((err) => {
    console.log("Error" + err);
  });
const db = {};
db.Sequelize = Sequelize;
db.sequelize = sequelize;

outputSequelize
  .authenticate()
  .then(() => {
    console.log("output database connected successfully");
  })
  .catch((err) => {
    console.log("Report Error : " + err);
  });
const dbOutput = {};
dbOutput.Sequelize = Sequelize;
dbOutput.sequelize = outputSequelize;

// Emotional will model :
db.keyValuePairs = require("./platform/keyValue/keyValuePair")(sequelize, DataTypes);
db.keyValuePairApproval = require("./tools/keyValuePair/keyValuePairApprovalModel")(sequelize, DataTypes);
db.categoryKeyValue = require("./platform/keyValue/CategoryKeyValue")(sequelize, DataTypes);

// UAM tool models
db.tmsUsers = require("./tools/tmsUsersModel")(sequelize, DataTypes);
db.uamUserGroups = require("./tools/uam/uamUserGroupsModel")(
  sequelize,
  DataTypes
);
db.uamRequest = require("./tools/uam/uamRequestModel")(sequelize, DataTypes);
db.uamToolDetails = require("./tools/uam/uamToolDetailsModel")(
  sequelize,
  DataTypes
);

db.uamToolUsers = require("./tools/uam/uamToolUsersModel")(
  sequelize,
  DataTypes
);

// HR Repository Models
db.importantLinkList = require("./tools/hrRepository/importantLinkList")(
  sequelize,
  DataTypes
);
db.policyList = require("./tools/hrRepository/policyList")(
  sequelize,
  DataTypes
);

// Referral System
// TODO: Re-enable when referral models are created
// db.referralScheme = require("./platform/referralSystem/referralSchemeModel")(
//   sequelize,
//   DataTypes
// );
// db.userReferralModel = require("./platform/referralSystem/userReferralModel")(
//   sequelize,
//   DataTypes
// );

// ==================================== HRMS Tools Models ================================================================
dbOutput.employeeComponentConfigurator = require("./tools/hrmsTools/employeeComponentConfiguratorModel")(outputSequelize, DataTypes);
dbOutput.employeeAddressDetails = require("./tools/hrmsTools/employeeAddressDetailsModel")(outputSequelize, DataTypes);
dbOutput.employeeAdvanceSalaryDetailHistory = require("./tools/hrmsTools/employeeAdvanceSalaryDetailHistoryModel")(outputSequelize, DataTypes);
dbOutput.employeeAdvanceSalaryDetails = require("./tools/hrmsTools/employeeAdvanceSalaryDetailsModel")(outputSequelize, DataTypes);
dbOutput.employeeBankAccountDetails = require("./tools/hrmsTools/employeeBankAccountDetailsModel")(outputSequelize, DataTypes);
dbOutput.employeeBankAccountDetailHistory = require("./tools/hrmsTools/employeeBankAccountDetailHistoryModel")(outputSequelize, DataTypes);
dbOutput.employeeBasicDetails = require("./tools/hrmsTools/employeeBasicDetailsModel")(outputSequelize, DataTypes);
dbOutput.employeeContactDetails = require("./tools/hrmsTools/employeeContactDetailsModel")(outputSequelize, DataTypes);
dbOutput.employeeJobDetailHistory = require("./tools/hrmsTools/employeeJobDetailHistoryModel")(outputSequelize, DataTypes);
dbOutput.employeeJobDetails = require("./tools/hrmsTools/employeeJobDetailsModel")(outputSequelize, DataTypes);
dbOutput.employeeLoginHistory = require("./tools/hrmsTools/employeeLoginHistoryModel")(outputSequelize, DataTypes);
dbOutput.employeeSalaryDetailHistory = require("./tools/hrmsTools/employeeSalaryDetailHistoryModel")(outputSequelize, DataTypes);
dbOutput.employeeSalaryDetails = require("./tools/hrmsTools/employeeSalaryDetailsModel")(outputSequelize, DataTypes);
dbOutput.employmentHistory = require("./tools/hrmsTools/employmentHistoryModel")(outputSequelize, DataTypes);
dbOutput.employeeDataRequest = require("./tools/hrmsTools/employeeDataRequestModel")(outputSequelize, DataTypes);

dbOutput.employeeLeaveConfigurator = require("./tools/hrmsTools/employeeLeaveConfiguratorModel")(outputSequelize, DataTypes);
dbOutput.employeeHolidayDetails = require("./tools/hrmsTools/employeeHolidayDetailsModel")(outputSequelize, DataTypes);
dbOutput.employeeLeaveBalanceDetails = require("./tools/hrmsTools/employeeLeaveBalanceModel")(outputSequelize, DataTypes);
dbOutput.employeeAttendanceDetails = require("./tools/hrmsTools/employeeAttendanceModel")(outputSequelize, DataTypes);
dbOutput.employeeLeaveRequestDetails = require("./tools/hrmsTools/employeeLeaveRequestModel")(outputSequelize, DataTypes);
dbOutput.hrmsEmailLogs = require("./tools/hrmsTools/hrmsEmailLogsModel")(outputSequelize, DataTypes);
dbOutput.hrmsNotificationLogs = require("./tools/hrmsTools/hrmsNotificationModel")(outputSequelize, DataTypes);

//salary Configurator and Components
dbOutput.salaryCategories = require("./tools/hrmsTools/salaryConfigurator/salary_categories_model")(outputSequelize, DataTypes);
dbOutput.salaryComponents = require("./tools/hrmsTools/salaryConfigurator/salary_components_model")(outputSequelize, DataTypes);

//Payroll related models
dbOutput.employeePayslipRecords = require("./tools/hrmsTools/Payroll/employeePayslipRecordsModel")(outputSequelize, DataTypes);
dbOutput.employeePayslipItems = require("./tools/hrmsTools/Payroll/employeePayslipItemsModel")(outputSequelize, DataTypes);
dbOutput.employeeComponentAdjustments = require("./tools/hrmsTools/Payroll/employeeComponentAdjustmentsModel")(outputSequelize, DataTypes);

db.refreshTokens = require("./platform/auth/refreshToken")(sequelize, DataTypes);
db.authTokens = require("./platform/auth/authToken")(sequelize, DataTypes);



// ====================================partner onboardin models ============================================================
// ====================================partner onboardin models ends =======================================================
// ====================================partner monetization models ============================================================

// ====================================partner feature tool models ============================================================
db.allCountryDetails = require("./platform/regionalSettings/allCountryDetailsModel")(sequelize, DataTypes);


// partner product configure models

db.sequelize
  .sync({ force: false, alter: false })
  .then(() => {
    console.log(" main model sync completed");
  })
  .catch((err) => {
    console.log(err);
  });

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

export { db, dbOutput, sequelize, outputSequelize };