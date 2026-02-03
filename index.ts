import appInsights from "applicationinsights";

if (process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
  appInsights
    .setup()
    .setAutoDependencyCorrelation(true)
    .setAutoCollectRequests(true)
    .setAutoCollectPerformance(true, true)
    .setAutoCollectExceptions(true)
    .setAutoCollectDependencies(true)
    .setAutoCollectConsole(true, true)
    .setUseDiskRetryCaching(true)
    .setSendLiveMetrics(true)
    .setDistributedTracingMode(appInsights.DistributedTracingModes.AI_AND_W3C)
    .enableWebInstrumentation(true)
    .start();
}

import dotenv from "dotenv";
dotenv.config();

// Global sequlize patch, this function is responsible for patching sequelize model naming convention
// This is required to ensure that sequelize models are named in a consistent way across the application
// Implemented during the cloud migration to tackle the casing and pluralizing of model names
import "./models/globalSequelizePatch";

import { startServer } from "./server";
import { createApp } from "./app";
import { startCronJobs } from "./cron";

// Create Express app
const app = createApp();

// Startup Cron Jobs
startCronJobs();

import { syncDatabase } from "./models";
// Sync Database
syncDatabase();

//server listening
startServer(app);

process.on('SIGINT', () => {
  console.log('Shutting down the server...');
  process.exit(0); // Exit the process
});
