

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

import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import techRoutes from "./routes/tech";
import rsaWrapper from "./security/rsa-wrapper";

// NEW CRON JOBS (CONTAINS DEA JOBS AS WELL)
if (process.env.NODE_ENV !== 'preprod') { // this ensure that our crons will run on all places except for preprod as production and preprod will share same database
  // const { setCronJobMachineV2 } = require("./cronJobs/cron_v2");
  // setCronJobMachineV2();
}

const options: swaggerJsdoc.Options = {
  swaggerDefinition: {
    openapi: "3.0.0",
    info: {
      title: "Mittarv API documentation",
      version: "1.0.0",
      description: "The Mitt Arv API follows a RESTful architecture and is designed to be simple and secure. The API utilizes HTTPS for communication, with JSON responses returned for all interactions, including error messages.",
    },
    components: {
      securitySchemes: {
        customAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'Authorization',
          description: 'Please paste your JWT token below. Make sure not to include any extra spaces.'
        }
      }
    },
    security: [
      {
        customAuth: []
      }
    ],
    servers: [
      {
        url: process.env.BACKEND_URL || "http://localhost:5000",
      },
    ],
    tags: [
      {
        name: "User Authentication",
        description: "API to authenticate the existing user"
      },
      {
        name: "User Registration",
        description: "API to register create new user"
      },
      {
        name: "Connections",
        description: " APIs to create and manage contacts. These endpoints are accessible after the successful authentication."
      },
      {
        name: "Emotional Will",
        description: "APIs to create & manage text emotional will"
      },
      {
        name: "Text Will",
        description: "APIs to create & manage text emotional will"
      },
      {
        name: "Audio Emotional Will",
        description: "APIs to create & manage audio emotional will"
      },
      {
        name: "Video Emotional Will",
        description: "APIs for managing user Emotional will"
      },
      {
        name: "Asset Vault (Pre-API)",
        description: "APIs to Get All asset types by Country ID"
      },
      {
        name: "Asset Vault",
        description: "APIs to create and manage assets"
      },
      {
        name: "In-App Notifications",
        description: "APIs to manage In-App notifications"
      },
      {
        name: "Collaboration",
        description: "Create & Manage Collaboration Groups"
      },
      {
        name: "My Language",
        description: "Update user’s platform language"
      },
      {
        name: "User Countries",
        description: "Select and update user’s Country of Residence, Primary Country,  Additional Countries."
      },
      {
        name: "User Storage",
        description: " Get user’s overall storage"
      },
      {
        name: "Ispremium",
        description: "Check if the user is a premium user"
      },
      {
        name: "Account Activity",
        description: "Manage Account"
      },
      {
        name: "User Feedback",
        description: " APIs to share the user feedback"
      },
      
      
    ],
  },
  apis: [
    path.resolve(__dirname, './routes/platform/user.js'),
    path.resolve(__dirname, './routes/platform/subscriptionRoute.js'),
    path.resolve(__dirname, './routes/emotionalWill/*.js'),
    path.resolve(__dirname, './routes/platform/feedback/feedbackDetail.js'),
    path.resolve(__dirname, './routes/platform/storageRoutes.js'),
    path.resolve(__dirname, './routes/platform/notifications/*.js'),
    path.resolve(__dirname, './routes/platform/connection.js'),
    path.resolve(__dirname, './routes/platform/inAppNotificationRoute.js'),
    path.resolve(__dirname, './routes/platform/collaboration/collaborationV3Routes.js'),
    path.resolve(__dirname, './routes/platform/collaboration/collaborationRoutes.js'),
    path.resolve(__dirname, './routes/platform/regionalsettings/userSelectedLanguageroutes.js'),
    path.resolve(__dirname, './routes/platform/regionalSettings/userCountriesRoutes.js'),
    path.resolve(__dirname, './routes/assetVault/assetVaultUser.js'),
    path.resolve(__dirname, './routes/assetVault/assetdetails.js'),
    path.resolve(__dirname, './routes/platform/accountActivity/suspendAccountRoutes.js'),
    path.resolve(__dirname, './routes/platform/accountActivity/deleteAccountRoutes.js'),
  ],
};

const specs = swaggerJsdoc(options);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs));;


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
