// import { isCronJobMachine } from "../utilities/cronMachine";
// import { setCronJobHost } from "./../cron";
// import { analyticsPipeline } from "./jobs/analyticsCron";
// import { moengagePipeline } from "./jobs/moengageCron";
// const cron = require("node-cron");
// import { referralPipeline } from "./jobs/referralCron";
// const os = require("os");

// const createCronJob = (
//   cronJobTime: string,
//   cronJobName: string,
//   callBackFunction: () => void,
// ) => {
//   cron.schedule(cronJobTime, async () => {
//     console.log(`Scheduling ${cronJobName} at ${cronJobTime}`);

//     // Always update the host before executing the cron job
//     await setCronJobHost();

//     // Wait for 2 minutes before checking if this machine should execute the cron job
//     setTimeout(async () => {
//     const cronJobMachine = await isCronJobMachine();
//     if (!cronJobMachine) {
//         console.log(`Skipping ${cronJobName} on ${os.hostname()} (Not the cron job machine)`);
//       return;
//     }

//     console.log(`Executing ${cronJobName} at ${cronJobTime} on machine ${os.hostname()}`);
//     callBackFunction();
//     }, 120000); // 2 min delay
//   });
// };

// export const setCronJobMachineV2 = async () => {
//   try {
//     // Running analytics at 23:52 UTC to ensure correct metric date calculations before the day changes.  
//     createCronJob("55 23 * * *", "AnalyticsPipeline", analyticsPipeline);
//     // // Running the referral pipeline exactly at 00:00 UTC to process new day's data.  
//     createCronJob("0 0 * * *", "ReferralPipeline", referralPipeline);
//     // Running the Moengage Pipeline exactly at 23:30 UTC
//     // THIS PIPELINE IS TO BE ONLY RAN ON PRODUCTION REGION
//     if (process.env.NODE_ENV == 'PRODUCTION') {
//       createCronJob("30 23 * * *", "MoengagePipeline", moengagePipeline);
//     }

//   } catch (error) {
//     console.error("Error initializing cron jobs:", error);
//   }
// };
