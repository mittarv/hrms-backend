import os from 'os';
import dotenv from 'dotenv';
import { createPayrollCronJob } from './controllers/tools/hrmsTools/PayrollController';
import cron from 'node-cron';

dotenv.config();

/**
 * Checks if this machine should run cron jobs
 * This prevents multiple instances from running the same cron jobs
 */
const isCronJobMachine = (): boolean => {
  const cronMachineHostname = process.env.CRON_JOB_MACHINE_HOSTNAME;
  
  if (!cronMachineHostname) {
    console.log('⚠️  CRON_JOB_MACHINE_HOSTNAME not set in environment variables');
    return false;
  }

  const currentHostname = os.hostname();
  const isCronMachine = currentHostname === cronMachineHostname;
  
  if (!isCronMachine) {
    console.log(`ℹ️  Cron jobs disabled on ${currentHostname}. Enabled only on: ${cronMachineHostname}`);
  }
  
  return isCronMachine;
};

/**
 * TEST CRON JOB - Runs every minute for testing
 * This helps you verify that cron jobs are working
 */
const testCronJob = async () => {
  try {
    const shouldRun = isCronJobMachine();
    if (!shouldRun) {
      return;
    }

    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    console.log(`✅ [TEST CRON] Running at ${timestamp} on ${os.hostname()}`);
  } catch (error) {
    console.error('❌ Error in test cron job:', error);
  }
};

/**
 * Initialize and schedule all cron jobs
 */
export const initializeCronJobs = () => {
  try {
    console.log('Initializing HRMS cron jobs...');
    
    // TEST CRON - Runs every minute (for testing only)
    // Comment this out in production
    cron.schedule('* * * * *', createPayrollCronJob);
    console.log('  ✓ Test cron (every minute) - ENABLED FOR TESTING');
    
    console.log('✅ All cron jobs initialized successfully\n');
  } catch (error) {
    console.error('❌ Failed to initialize cron jobs:', error);
  }
};

/**
 * Start all cron jobs
 * Call this function in your main application entry point (index.ts)
 */
export const startCronJobs = () => {
  const shouldRun = isCronJobMachine();
  
  if (shouldRun) {
    console.log(`\n🎯 Starting cron jobs on ${os.hostname()}\n`);
    initializeCronJobs();
  } else {
    console.log('⏸️  Cron jobs not started - machine hostname does not match');
  }
};

// Export individual functions if needed elsewhere
export {
  isCronJobMachine,
  testCronJob,
};
