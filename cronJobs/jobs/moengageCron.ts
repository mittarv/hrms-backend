import { db } from "../../models/index";
import { ClassMoengageUsers } from "../classes/moengageClasses";
const Users = db.users;

export const moengagePipeline = async () => {
    console.log(`[${new Date().toISOString()}] Starting MoEngage pipeline...`);
    try {
        const moengageClassInstance = new ClassMoengageUsers();
        await moengageClassInstance.processMoengageUsers();

        console.log(`[${new Date().toISOString()}] MoEngage pipeline completed successfully.`);
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error in MoEngage pipeline:`, error);
    }
};
