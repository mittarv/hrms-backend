const { dbOutput } = require("../models");

const KeyValuePairs = dbOutput.keyValuePairs;
const os = require("os");



/**
 * This function is used to check if the cron job is running on the same machine as the previous cron job.
 * It is used to avoid race condition in the cron job.
 */
exports.isCronJobMachine = async () => {
    try {
      const record = await KeyValuePairs.findOne({
        where: {
          category: "cron_job_machine",
        },
      });
      if (record) {
        console.log(`machine id for cron job is ${record.value}`);
        return true;
        
      }
      return false;
    } catch (error) {
      console.log(error.message);
    }
  };



  