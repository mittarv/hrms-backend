// moengageClasses.ts
import { IMoengageReqBody, IReqBodyAttributes, INewUsers, INewNewsLetterSubscribers } from "../Interfaces/moengageInterfaces";
import { db, dbOutput } from "../../models/index";
import { Op } from "sequelize";
import axios from "axios";

const Users = db.users;
const CategoryKeyValuePair = db.categoryKeyValue;
const NewsLetterSubscriber = dbOutput.newsletterSubscriber;
export class ClassMoengageUsers {
    // GETS THE LAST COPIED USED ID FROM TEH USERS TABLE
    private async getLastCopiedUserId(): Promise<number | null> {
        const lastCopiedUserId = await CategoryKeyValuePair.findOne({
            attributes: ['value'],
            where: {
                category: "cron_last_copied_records",
                key: "moengage_cron_last_copied_userId"
            }
        });
        return lastCopiedUserId?.value ?? null;
    }

    // GETS THE LAST COPIED USED ID FROM THE NewsLetter TABLE
    private async getLastCopiedNewsLetterId(): Promise<number | null> {
        const lastCopiedNewsLetterUserId = await CategoryKeyValuePair.findOne({
            attributes: ['value'],
            where: {
                category: "cron_last_copied_records",
                key: "moengage_cron_last_copied_newsletter_userId"
            }
        });
        return lastCopiedNewsLetterUserId?.value ?? null;
    }

    // UPDATES THE NEW ID ONLY IF THERE WAS NO ERROR IN THE MOENGAGE API FOR ANY RECORDS ELSE THIS IS NOT CALLED
    private async updateLastCopiedUserId(lastUserId: string): Promise<void> {
        await CategoryKeyValuePair.update(
            { value: lastUserId },
            {
                where: {
                    category: "cron_last_copied_records",
                    key: "moengage_cron_last_copied_userId"
                }
            }
        );
    }

    // UPDATES THE NEW ID ONLY IF THERE WAS NO ERROR IN THE MOENGAGE API FOR ANY RECORDS ELSE THIS IS NOT CALLED
    private async updateLastCopiedNewLetterUserId(lastUserId: string): Promise<void> {
        await CategoryKeyValuePair.update(
            { value: lastUserId },
            {
                where: {
                    category: "cron_last_copied_records",
                    key: "moengage_cron_last_copied_newsletter_userId"
                }
            }
        );
    }

    // FETCHES NEW USER FROM THE LAST PROCESSED USER
    async fetchNewUsers(lastUserId: number | null): Promise<INewUsers[]> {
        return await Users.findAll({
            attributes: ['id', 'name', 'email'],
            where: { id: { [Op.gt]: lastUserId } },
        }) as Promise<INewUsers[]>;
    }

    // TO MAKE THE OBJECT FOR MOENGAGE
    toJSON(customer_id: string, name: string, email: string, customInstall: boolean): string {
        return JSON.stringify({
            customer_id: customer_id,
            attributes: {
                u_n: name,
                u_em: email,
                ma_custom_install: customInstall,
            },
        });
    }

    // GET ALL THE UNIQUE EMAIL NOT IN USER TABLE AND IN NEWSLETTER TABLE WHICH ARE NOT REGISTERED YET
    async fetchAllValidNewsLetterSubscriber(lastProcessedNewsLetterUserId: number | null): Promise<INewNewsLetterSubscribers[]> {

        // THIS CAN BE OPTIMIZED BY SKIPPING IF MOENGAGE API HAVE A CHECK TO NOT ALLOW DUPLICATE BUT FOR NOW KEEPING EXTRA CHECK
        const registeredEmails = (await Users.findAll({
            attributes: ['email'],
        })).map(user => user.email);

        return await NewsLetterSubscriber.findAll({
            where: {
                email: {
                    [Op.notIn]: registeredEmails,
                },
                isRegistered: false,
                id: {
                    [Op.gt]: lastProcessedNewsLetterUserId,
                }
            },
        }) as Promise<INewNewsLetterSubscribers[]>;
    }

    // SIMPLY UPDATES THE FLAG 
    private async updateIsRegisteredFlagNewsLetter() {
        await NewsLetterSubscriber.update(
            { isRegistered: true },
            {
                where: {
                    isRegistered: false,
                },
            }
        );

    }

    // SENDS DATA TO MOENGAGE ALSO RETURNS TRUE IF ALL GOES WELL / FALSE IF SOMETHING GOES WRONG
    async sendToMoEngage(payload: string): Promise<boolean> {
        try {
            console.log("payload", payload);
            const response = await axios.post(`https://api-01.moengage.com/v1/customer/${process.env.MOENGAGE_HEADERS_APP_ID}`, payload, {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `${process.env.MOENGAGE_HEADERS_AUTHORIZATION}`
                },
            });

            console.log("MoEngage Response:", response.data);

            // Ensure the request was successful (check for status)
            return response.data.status === 'success';
        } catch (error) {
            console.error("Error sending to MoEngage:", error.response?.data || error.message);
            return false; // Failure case
        }
    }

    //MAIN FUNCTION
    async processMoengageUsers(): Promise<void> {
        try {
            const lastProcessedUserId = await this.getLastCopiedUserId();
            const lastProcessedNewsLetterUserId = await this.getLastCopiedNewsLetterId();

            if (lastProcessedUserId == null || lastProcessedNewsLetterUserId == null) {
                console.warn("Missing required IDs. Aborting MoEngage sync.");
                return;
            }

            const newRegisteredUsers = await this.fetchNewUsers(lastProcessedUserId);
            const validNewsLetterSubscriber = await this.fetchAllValidNewsLetterSubscriber(lastProcessedNewsLetterUserId);

            if (newRegisteredUsers.length > 0) {
                let allUsersSent = true;

                for (const user of newRegisteredUsers) {
                    const userPayload = this.toJSON(user.email, user.name, user.email, true);
                    const isSent = await this.sendToMoEngage(userPayload);

                    if (!isSent) {
                        console.warn(`Failed to send user ${user.id} to MoEngage.`);
                        allUsersSent = false;
                        break; // Stop 
                    }
                }

                // Update only if all users were successfully sent else dont so that they can be proccessed again in next run
                if (allUsersSent) {
                    await this.updateLastCopiedUserId(newRegisteredUsers[newRegisteredUsers.length - 1].id);
                }
            } else {
                console.log("No new users to process.");
            }

            if (validNewsLetterSubscriber.length > 0) {
                let allNewsletterUsersSent = true;

                for (const user of validNewsLetterSubscriber) {
                    const userPayload = this.toJSON(user.email, user.email, user.email, false);
                    const isSent = await this.sendToMoEngage(userPayload);

                    if (!isSent) {
                        console.warn(`Failed to send newsletter user ${user.id} to MoEngage.`);
                        allNewsletterUsersSent = false;
                        break; // Stop 
                    }
                }

                // Update only if all users were successfully sent else dont so that they can be proccessed again in next run
                if (allNewsletterUsersSent) {
                    await this.updateIsRegisteredFlagNewsLetter();
                    await this.updateLastCopiedNewLetterUserId(validNewsLetterSubscriber[validNewsLetterSubscriber.length - 1].id);
                }
            } else {
                console.log("No new newsletter users to process.");
            }

        } catch (error) {
            console.error("Error processing MoEngage users:", error);
        }
    }


}