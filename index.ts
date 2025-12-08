

// Global sequlize patch, this function is responsible for patching sequelize model naming convention
// This is required to ensure that sequelize models are named in a consistent way across the application
// Implemented during the cloud migration to tackel the casing and pluralizing of model names
import "./models/globalSequelizePatch";

// const express = require("express");
import express, { Application, NextFunction, Request, Response } from "express";
// const cors = require("cors");
import cors from "cors";
// const cookieParser = require("cookie-parser");
import cookieParser from "cookie-parser";
// const path = require("path");
import path from "path";
// const helmet = require("helmet");
import helmet from "helmet";
import bodyParser from "body-parser";

// const app =  express();
// const app = Application().express();
const app: Application = express();
// require("dotenv").config();
import dotenv from "dotenv";
// import { app } from 'firebase-admin';
dotenv.config();
//declaring the port
// const port = process.env.PORT || 5000;

const port: string = process.env.PORT || "5000";


//using the middlewares
app.use(express.json({ limit: "1000mb" }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
  cors({
    origin : '*'
  })
);
app.use(helmet());
app.disable("x-powered-by");
app.use("/images", express.static(path.join(__dirname, "/public/images")));

import techRoutes from "./routes/tech";
import rsaWrapper from "./security/rsa-wrapper";


// UAM tool routes
import tmsUsersRoutes from "./routes/tools/tmsUsersRoutes";
import uamToolDetailsRoutes from "./routes/tools/uam/uamToolDetailsRoutes";
import uamToolUsersRoutes from "./routes/tools/uam/uamToolUsersRoutes";
import uamUserGroupRoutes from "./routes/tools/uam/uamUserGroupRoutes";
import uamRequestRoutes from "./routes/tools/uam/uamRequestRoutes";

//=====================================hr repository related routes===================================================================
import importantlinkAndPolicyRoutes from "./routes/tools/hrRepository/importantLinkAndPolicyRoutes";

//============================importing send log route===========================
import sendLog from "./routes/loggingRoute/loggingRoute";

// ====Tools access api ===================
import uamToolAccessRoute from "./routes/tools/uam/uamToolsAccessManagement";
import { createLoggingMiddleware } from "./middlewares/logging";


// HRMS Tools Routes
import employeeComponentConfiguratorRoutes from "./routes/tools/hrmsTools/employeeComponentConfiguratorRoutes";
import employeeDetailsRoutes from "./routes/tools/hrmsTools/employeeDetailsRoutes";
import employeeLeaveConfiguratorRoutes from "./routes/tools/hrmsTools/employeeLeaveConfiguratorRoutes";
import employeeHolidayRoutes from "./routes/tools/hrmsTools/employeeHolidayRoutes";
import employeeAttendanceRoutes from "./routes/tools/hrmsTools/employeeAttendanceRoutes";
import employeeNotificationsRoutes from "./routes/tools/hrmsTools/employeeNotificationsRoutes";
import salaryConfiguratorRoutes from "./routes/tools/hrmsTools/salaryConfiguratorRoutes"
import PayrollRoutes from "./routes/tools/hrmsTools/PayrollRoutes";


// all country routes
import allCountryRoutes from "./routes/platform/allCountryRoutes";


//using the routes
rsaWrapper.initLoadServerKeys();

app.use(createLoggingMiddleware());

const logExecutionTime = (req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV === "LOCAL") {
    const startHrTime = process.hrtime();
    res.on("finish", () => {
      const elapsedHrTime = process.hrtime(startHrTime);
      const elapsedTimeInMs = elapsedHrTime[0] * 1000 + elapsedHrTime[1] / 1e6;
      console.info(
        `${req.method} ${req.originalUrl} took ${elapsedTimeInMs.toFixed(3)} ms`
      );
    });
  }

  // Always call next(), even if NODE_ENV is not "LOCAL"
  next();
};



app.use(logExecutionTime);
//health check and system routes
app.use("/api/", techRoutes);
app.use("/api/details", techRoutes);

//logging routes
app.use("/api/logging", sendLog);


// UAM tool routes
app.use("/api/tms/users", tmsUsersRoutes);
app.use("/api/uam/tools", uamToolDetailsRoutes);
app.use("/api/uam/tools/users", uamToolUsersRoutes);
app.use("/api/uam/permissions", uamUserGroupRoutes);
app.use("/api/uam/request", uamRequestRoutes);


//hr repository related routes
app.use("/api/hrrepository", importantlinkAndPolicyRoutes);

// tool acces route
app.use("/api/tms/toolpermission", uamToolAccessRoute);

//HRMS tool routes
app.use("/api/hrms/empConfig", employeeComponentConfiguratorRoutes);
app.use("/api/hrms/empDetails", employeeDetailsRoutes);
app.use("/api/hrms/leaveConfig", employeeLeaveConfiguratorRoutes);
app.use("/api/hrms/empHoliday", employeeHolidayRoutes);
app.use("/api/hrms/empAttendanceManagement", employeeAttendanceRoutes);
app.use("/api/hrms/Notifications", employeeNotificationsRoutes);
app.use("/api/hrms/salaryConfigurator", salaryConfiguratorRoutes);
app.use("/api/hrms/payroll", PayrollRoutes);

// all country routes
app.use("/api/platform/allCountries", allCountryRoutes);



//server listening
app.listen(port, () => {
  console.log("Starting the listing process.");
  console.log(
    `${process.env.NODE_ENV} Server is running on port: http://localhost:${port}`
  );
});


process.on('SIGINT', () => {
  console.log('Shutting down the server...');
  process.exit(0); // Exit the process
});


module.exports = app;
