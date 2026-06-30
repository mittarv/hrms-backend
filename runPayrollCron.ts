import dotenv from 'dotenv';
dotenv.config();

import { createPayrollCronJob } from './controllers/tools/hrmsTools/PayrollController';

(async () => {
    try {
        console.log("Running payroll cron job manually...");
        await createPayrollCronJob();
        console.log("Payroll cron job finished.");
    } catch (error) {
        console.error("Error running payroll cron job:", error);
    }
    process.exit();
})();
