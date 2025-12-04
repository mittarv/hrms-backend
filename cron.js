// const cron = require("node-cron");
// const { db, sequelize } = require("./models/index");
// const os = require("os");
// const {
//   cLSIPhase1EmailNotification,
//   cLSIUserHasNoTCEmail,
//   cLSIPhase2EmailNotification,
//   otherTCEmailNotification,
//   cLSIResponseConflictEmail,
//   sendEWDraftRemainderEmails,
//   hybridCLSI_Day_01_50_EmailNotification,
//   hybridCLSI_Day_90_EmailNotification,
//   hybridCLSI_Day_60_80_EmailNotification,
//   hybridCLSI_Day_91_110_EmailNotification,
//   hybridCLSI_Day_120_140_EmailNotification,
//   hybridCLSI_Day_150_EmailNotification,
//   hybridCLSI_Conflict_EmailNotification,
//   cLSIFinalMessageToUserEmail,
// } = require("./middlewares/sendEmail");
// const UserActiveStatus = db.userActiveStatus;
// const UserEmailTrack = db.userEmailTrack;
// const User = db.users;
// const TCConnection = db.tCConnection;
// const Connection = db.connections;
// const TCEmailTrack = db.tCEmailTrack;
// const KeyValuePairs = db.keyValuePairs;
// const TCResponse = db.tCResponse;
// const AllWills = db.allwills;
// const AssetGroup = db.assetGroups;
// const AssetDetails = db.assetDetails;
// const ShareAssets = db.shareAssets;
// const UserFinalStatusByTC = db.userFinalStatusByTC;
// const { Op } = require("sequelize");
// const moment = require("moment");
// const { isCronJobMachine } = require("./utilities/cronMachine");
// const { logData } = require("./apiLogging/sendData");
// const { updateStorageSizeById } = require("./controllers/platform/storageController")
// const {
//   isValidAzureUrl,
//   getBlobSizeFromUrl,
// } = require("./utilities/azure");
// const { log } = require("console");
// const { isNill } = require("./utilities/utilities");
// const { deleteScheduledAssets } = require("./utilities/userAV/avCronJob");
// const { filterNonPremiumUsers, getMostEligibleMember } = require("./utilities/helperFunctions");
// const { renewalEmailNoticationsMonthly } = require("./cronJobs/jobs/payments/renewalRemainderCron");
// const { gracePeriodEmailNotications } = require("./cronJobs/jobs/payments/gracePeriodReminders");
// const { renewalEmailNoticationsYearly } = require("./cronJobs/jobs/payments/yearlyRenewalNotification");
// const { generateInvoicesForUpcomingMandates, triggerTransactionForUpcomingMandates, processCancelledSubscriptionsForExpiry } = require("./cronJobs/jobs/payments/billdeskMandateCron");
// const { SubscriptionStatus } = require("./interfaces/subscriptonInterfaces/enums/enums");
// const { notificationsCron } = require("./cronJobs/jobs/notifications/notificationsCron");
// const { markUserAsDeceased, createTCEmailTrack, movingUserToPhase, getUserInactiveDays, getTCsRespondedToConflictMail, userStatus } = require("./controllers/CLS/utils/cls");
// const { deleteUserDataByUserId } = require("./utilities/deleteUserData");
// const DraftWills = db.draftwills
// const CategoryKeyValue = db.categoryKeyValue;
// const EwMultipleRecipients = db.ewMultipleRecipients


// //userPhase 1 is defined as the users default phase the emails are sent to the user in this phase itself where if they have been inactive for more than A1 no but leass than A2 days
// //userPhase 2 is defined when the user has crossed the A1 + A2 no of days and is less than A1+A2+A3 no of days. In this phase the emails are sent to the trusted contacts of the user
// //userPhase 3 is defined we check for if the conflicts are present in the trusted contacts reponses if not then the final status is calculated and if present then the user is moved to phase 4 of the status
// //userPhase 4 is defined as the user final status will be calculated and the user will be moved to phase 5
// //userPhase 5 is defined when the user status is finalised and then actions are taken on the decision

// //important note about phase 3 and 4:
// //if the user is in phase 3 and the user has conflicts then the user is not immediately moved to phase 4;
// //if the user is in phase 3 and the user has no conflicts then the user is moved to phase 4.
// //if the user is in phase 4 still they can have conflicts.
// //if the user conflicts in phase 3 are not defined then the user should only be moved to phase 4 when the time period of A1+A2+A3 no of days is over.
// //In the time period of A1+A2+A3 the user trusted contacts can have conflicts and both the phases 3 and 4 will start and end here itself.

// /**
//  * Variables for tracking days in phase 1 and phase 2 email notification system
//  * 
//  * @var {number} A1 - A1 is the number of days after which the user will be moved to phase 2
//  * @var {number} A2 - A2 is the number of days after which the user will be moved to phase 3
//  * @var {number} A3 - A3 is the number of days after which the user will be moved to phase 4
//  * @var {number} A4 - A4 is the number of days after which the user will be moved to phase 5
//  * 
//  * @var {Set} day_list_phase_1 - Set containing days when phase 1 emails should be sent
//  *                               Elements: [A1, A2, A3, A4]
//  * 
//  * @var {Set} day_list_phase_2 - Set containing days when phase 2 emails should be sent
//  *                               Elements: [A2+1, Y2, Y3, Y4, Y5, Y6, A3]
//  */
// var A1, A2, A3, A4;
// var day_list_phase_1 = new Set(),
//   day_list_phase_2 = new Set();

// // Fetching A1,A2,A3,A4,day_list_phase_1, day_list_phase_2 from KeyValuePair table
// const initializeDayLists = async () => {
//   // Fetching A1,A2,A3,A4,day_list_phase_1, day_list_phase_2 from KeyValuePair table
//   const A1_temp = await KeyValuePairs.findOne({ where: { category: "A1" } });
//   const A2_temp = await KeyValuePairs.findOne({ where: { category: "A2" } });
//   const A3_temp = await KeyValuePairs.findOne({ where: { category: "A3" } });
//   const A4_temp = await KeyValuePairs.findOne({ where: { category: "A4" } });

//   const day_list_phase_1_temp = await KeyValuePairs.findAll({
//     where: { category: "day_list_phase_1" },
//   });
//   const day_list_phase_2_temp = await KeyValuePairs.findAll({
//     where: { category: "day_list_phase_2" },
//   });

//   day_list_phase_1.clear();
//   day_list_phase_1_temp.map((key) => {
//     day_list_phase_1.add(parseInt(key["dataValues"]["value"]));
//   });

//   day_list_phase_2.clear();
//   day_list_phase_2_temp.map((key) => {
//     day_list_phase_2.add(parseInt(key["dataValues"]["value"]));
//   });

//   A1 = parseInt(A1_temp["dataValues"]["value"]);
//   A2 = parseInt(A2_temp["dataValues"]["value"]);
//   A3 = parseInt(A3_temp["dataValues"]["value"]);
//   A4 = parseInt(A4_temp["dataValues"]["value"]);
// }

// /**
//  * This function is used to send email to the users who are in phase 1
//  * @param {Array} usersId - The list of user IDs
//  * @param {Array} usersDays - The list of days
//  * @param {Array} usersEmail - The list of user emails
//  * @param {Array} usersName - The list of user names
//  * @param {Array} usersSubscriptionExpired - The list boolean values whether the subscription is expired or not
//  */
// async function sendEmailPhase1(usersId, usersDays, usersEmail, usersName, usersSubscriptionExpired) {
//   for (var i = 0; i < usersId.length; i++) {
//     const isUserWithExpiredSubscription = usersSubscriptionExpired[i];

//     // if subscription is expired
//     // sends hybrid CLSI email
//     // else sends cLSI phase 1 email
//     if(isUserWithExpiredSubscription){
//       //sends the hybrid CLSI email to the user
//       await sendHybridEmailNotifications({email: usersEmail[i], days: usersDays[i] + A1, username1: usersName[i]});
//     } else {
//       //sends the email to the user
//       await cLSIPhase1EmailNotification(
//         usersEmail[i],
//         usersDays[i],
//         usersName[i]
//       );
//     }

//     //creates a track of the email sent to the user
//     await UserEmailTrack.create({
//       userId: usersId[i],
//       emailKeyId: usersDays[i],
//       sendTime: new Date(),
//     });
//   }

// }

// /**
//  * This function is used to send email to the trusted contacts of the users who are in phase 2
//  * If no tc are found then the user is moved to phase 5 and email is sent to the user
//  * This function is divided into 3 phases:
//  * 1. User have 0 trusted contacts (user moves to phase 4)
//  * 2. User have only one trusted contact (user moves to phase 4)
//  * 3. User have multiple trusted contacts (user moves to phase 3)
//  * @param {Array} usersId - The list of user IDs
//  * @param {Array} usersDays - The list of days
//  * @param {Array} usersSubscriptionExpired - The list boolean values whether the subscription is expired or not
//  */
// async function sendEmailPhase2(usersId, usersDays, usersSubscriptionExpired) {
//   //iterating over the users who are in phase 2 or in phase 3 and sending emails to their trusted contacts
//   //if the user has no trusted contacts then sending email to the user
//   for (var i = 0; i < usersId.length; i++) {
//     var userIdTemp = usersId[i];
//     var userTC = await TCConnection.findAll({
//       where: {
//         userId: userIdTemp,
//         isConnectionTrusted: true,
//       },
//     });

//     // checking if the user has expired subscription
//     const isUserWithExpiredSubscription = usersSubscriptionExpired[i];

//     // getting the user data
//     var usersData = await User.findOne({
//         where: { id: userIdTemp },
//     });

//     // user have 0 trusted contacts
//     if (
//       userTC.length == 0 &&
//       usersDays[i] == day_list_phase_2.keys().next().value
//     ) {
//       // email that we will release the will after A1+A2+A3+A4= A5 days
//       // TODO: sending hybrid CLSI notification if the user has no trusted contacts
//       if(isUserWithExpiredSubscription){
//         //sends the hybrid CLSI email to the user
//         // await sendHybridEmailNotifications(usersData["dataValues"]["email"], usersDays[i], usersData["dataValues"]["name"]);
//       } else {
//         //sending email to the user
//         await cLSIUserHasNoTCEmail(
//           usersData["dataValues"]["email"],
//           usersDays[i],
//           usersData["dataValues"]["name"]
//         );
//       }

//       //moving the user to phase 4
//       await movingUserToPhase({userId: usersId[i], userPhase: 4});
//     }

//     // Phase 2.1 : user have only one trusted contact and sending email to the trusted contact
//     else if (userTC.length == 1) {
//       await Promise.allSettled(userTC.map(async (key) => {
//         // when TC(Trusted Contact) respond to the form we will set 'isResponded' as 1
//         var tempDays = usersDays[i];
//         var tempUserId = usersId[i];
//         //if the trusted contact has not responded to the email then sending email to the trusted contact
//         if (key["dataValues"]["isTCResponded"] == false) {
//           //getting the trusted contact data to send the email
//           var TCinfo = await Connection.findOne({
//             where: { id: key.dataValues.connectionId },
//           });
//           var usersData = await User.findOne({
//             where: { id: tempUserId },
//           });

//           // sending hybrid CLSI notification if the user has only one trusted contact
//           if(isUserWithExpiredSubscription){
//             //sends the hybrid CLSI email to the user
//             await sendHybridEmailNotifications({email: TCinfo.dataValues.email, days: tempDays + A1, username1: usersData["dataValues"]["name"], username2: TCinfo.dataValues.name});
//           } else {
//             //sending email to the trusted contact
//             await cLSIPhase2EmailNotification(
//               TCinfo.dataValues.email,
//               tempDays,
//               usersData.dataValues.name,
//               TCinfo.dataValues.name,
//               true //true indicates that this is the only Trusted Contact
//             );
//           }

//           await createTCEmailTrack(key.dataValues.connectionId, tempDays, new Date());

//           await TCConnection.update(
//             {
//               emailCount: key["dataValues"]["emailCount"] + 1,
//               eamilTime: new Date(),
//             },
//             {
//               where: { connectionId: key.dataValues.connectionId },
//             }
//           );
//         }
//         // if the trusted contact has responded to the email then moving the user to phase 4
//         else {
//           // moving the user to phase 4
//           await movingUserToPhase({userId: usersId[i], userPhase: 4});
//         }
//       }));
//     }

//     // Phase 2.2 : user have multiple trusted contacts
//     else {
//       var TCResponded = false; // to check if any of the trusted contacts have responded to the email
//       var tempDays = usersDays[i];
//       var tempUserId = usersId[i];
//       await Promise.all(userTC.map(async (key) => {
//         // when atleast one TC(Trusted Contact) respond to the form we will set 'TCResponded' as true
//         if (key["dataValues"]["isTCResponded"] == false) {
//           var TCinfo = await Connection.findOne({
//             where: { id: key.dataValues.connectionId },
//           });
//           //getting the user data to send the email
//           var usersData = await User.findOne({
//             where: { id: tempUserId },
//           });

//           // sending hybrid CLSI notification if the user has multiple trusted contact
//           if(isUserWithExpiredSubscription){
//             //sends the hybrid CLSI email to the user
//             await sendHybridEmailNotifications({email: TCinfo.dataValues.email, days: tempDays + A1, username1: usersData["dataValues"]["name"], username2: TCinfo.dataValues.name});
//           } else {
//             //sending email to the trusted contact
//             await cLSIPhase2EmailNotification(
//               TCinfo.dataValues.email,
//               tempDays,
//               usersData["dataValues"]["name"],
//               TCinfo.dataValues.name,
//               false // false indicates that this is not the only Trusted Contact
//             );
//           }

//           await createTCEmailTrack(key.dataValues.connectionId, tempDays, new Date());

//           await TCConnection.update(
//             {
//               emailCount: key["dataValues"]["emailCount"] + 1,
//               emailTime: new Date(),
//             },
//             {
//               where: { connectionId: key.dataValues.connectionId },
//             }
//           );
//         } else {
//           //setting the TCResponded to true if any of the trusted contact has responded to the email
//           TCResponded = true;
//         }
//       }));

//       //if at least one of the trusted contacts have responded to the email then moving the user to phase 3
//       if (TCResponded) {
//         // moving user to phase 3
//         await movingUserToPhase({userId: tempUserId, userPhase: 3})
//       }
//     }
//   }
// }

// // This function send email to other TC if one of the TC Responded by its own
// async function sendEmailToOtherTc(myConfidantId, tCId) {
//   //getting the trusted contacts of the user
//   var tC_of_user = await Connection.findAll({
//     where: {
//       userId: myConfidantId,
//       istrusted: true,
//       isDeleted: false,
//     },
//   });
//   //getting the users name to send the emails
//   var userName = await User.findOne({
//     where: {
//       Id: myConfidantId,
//     },
//     attributes: ["name"],
//   });
//   tC_of_user.map(async (key) => {
//     //checking if the trusted contact is not the user who has responded to the email
//     if (key["dataValues"]["connectionUserId"] != tCId) {
//       //sending email to the other trusted contact
//       otherTCEmailNotification(
//         key["dataValues"]["email"],
//         userName["dataValues"]["name"],
//         key["dataValues"]["name"]
//       );
//       //creating a track of the email sent to the other trusted contact
//       await createTCEmailTrack(key["dataValues"]["id"], 151, new Date());
//     }
//   });

//   // moving user to phase 3
//   // Phase 3 is defined to resolve user conflicts
//   await movingUserToPhase({userId: myConfidantId, userPhase: 3});
// }


// /**
//  * This function is used to check if there is any conflict in TC response.
//  * @param {*} TC_unique_response //dictionary of the response of the trusted contacts(Unique)
//  * @returns {boolean} - True if conflict is present, False otherwise
//  */
// function isConflictPresent(TC_unique_response) {
//   //counting the number of trusted contacts who are alive, terminally ill and deceased
//   var Alive_N_Kickin = 0,
//     Terminally_Ill = 0,
//     Deceased = 0;
//   //iterating over the trusted contacts responses
//   for (const key in TC_unique_response) {
//     //checking if the trusted contact is terminally ill
//     if (TC_unique_response[key] == "Terminally ill") {
//       Terminally_Ill++;
//     } else if (TC_unique_response[key] == "Deceased") {
//       Deceased++;
//     } else {
//       Alive_N_Kickin++;
//     }
//   }
//   //checking if there is any conflict in the trusted contacts responses
//   if (
//     (Alive_N_Kickin > 0 && Terminally_Ill > 0) ||
//     (Alive_N_Kickin > 0 && Deceased > 0) ||
//     (Terminally_Ill > 0 && Deceased > 0)
//   ) {
//     //returning true if there is any conflict
//     return true;
//   } else {
//     //returning false if there is no conflict
//     return false;
//   }
// }

// /**
//  * This function is used to check for conflicts in the trusted contacts responses and send conflict emails to the TC of the user.
//  * After this function all the conflicts of user have been resolved and the final response is stored in the userFinalStatusByTC table.
//  * @param {*} userActiveStatus //list of user active status
//  */
// async function conflictResolve(userActiveStatus) {
//   userActiveStatus.map(async (activeStatus) => {
//     // getting the user inactive days
//     const userInactiveDays = getUserInactiveDays(activeStatus?.lastLogin);

//     // process logic only if the user inactive days is in the day_list_phase_2
//     // that is the user has crossed A1+A2 days and is less than A1+A2+A3 days
//     if(!day_list_phase_2.has(userInactiveDays - A1)) return;
    
//     // Check if the user has a latest expired subscription
//     const expiredSubscription = await db.subscriptions.findOne({
//       where: {
//         status: SubscriptionStatus.EXPIRED,
//         userId: activeStatus?.userId,
//         isDeleted: false
//       },
//       order: [['createdAt', 'DESC']]
//     });

//     // getting the response of the trusted contacts from the TCResponse table
//     const tCResponseParticularUser = await fetchTCLatestResponses(activeStatus?.userId, activeStatus?.lastLogin);

//     // storing the response of the trusted contacts in a dictionary
//     const TC_unique_response = {};
//     tCResponseParticularUser.map((key) => {
//       TC_unique_response[key?.userId] =
//         key?.response;
//     });

//     // getting the user data
//     // getting the trusted contacts of the user
//     const [userData, tC_of_user] = await Promise.all([
//       User.findOne({
//         where: {
//           Id: activeStatus?.userId,
//         },
//         attributes: ["name", "email"],
//         raw: true
//       }),
//       Connection.findAll({
//         where: {
//           userId: activeStatus?.userId,
//           istrusted: true,
//           connectionUserId: { [Op.ne]: null },
//           isDeleted: false,
//         },
//         raw: true
//       })
//     ]);

//     // checking for conflicts in the trusted contacts responses
//     if (isConflictPresent(TC_unique_response)) {
//       // set of userIds who responded to the reachout mail
//       const respondedReachOutSet = new Set(Object.keys(TC_unique_response));

//       // filter TCs details who responded to the reachout mail
//       const TCsRespondedToReachOutMail = tC_of_user.filter(tc =>
//         respondedReachOutSet.has(tc?.connectionUserId?.toString())
//       );

//       // get TCs who responded to the conflict mail
//       const TCsRespondedToConflictMail = await getTCsRespondedToConflictMail(
//         activeStatus,
//         TCsRespondedToReachOutMail
//       );

//       // create a set of userIds from conflict mail responses
//       const conflictRespondedSet = new Set(
//         TCsRespondedToConflictMail.map(response => response.userId.toString())
//       );

//       // filter TCs who responded to reachout but NOT to conflict mail
//       const TCsRespondedToReachOutMailButNotToConflictMail = TCsRespondedToReachOutMail.filter(
//         tc => !conflictRespondedSet.has(tc.connectionUserId?.toString())
//       );

//       TCsRespondedToReachOutMailButNotToConflictMail.map(async (key1) => {
//         if(expiredSubscription) {
//           // sending hybrid CLSI email if there is a conflict in trusted contacts response
//           await sendHybridEmailNotifications({
//             email: key1?.email,
//             username1: userData?.name,
//             username2: key1?.name,
//             isConflict: true
//           });
//         } else {
//           cLSIResponseConflictEmail(
//             key1?.email,
//             userData?.name,
//             key1?.name
//           );
//         }

//         //for now i set the emailKeyId for conflict that send to TC as 1000 we can change this after ward
//         await createTCEmailTrack(key1?.id, 1000, new Date());
//       });
//     }

//     // checking if all the trusted contacts have responded
//     const allTCResponded = tCResponseParticularUser.length === tC_of_user.length;

//     // getting the primary trusted contact of the user
//     const primaryTC = tC_of_user.find(tc => tc.isPrimaryTrustedContact);
//     // getting the response of the primary trusted contact
//     const primaryTCResponseValue = TC_unique_response?.[primaryTC.connectionUserId];

//     // if all the trusted contacts have responded and there is no conflict
//     // and the primary trusted contact response is not alive and kickin
//     // then we will move the user to phase 4
//     if(allTCResponded && !isConflictPresent(TC_unique_response) && primaryTCResponseValue && primaryTCResponseValue != userStatus.AliveAndKickin) {
//       await movingUserToPhase({userId: activeStatus?.userId, userPhase: 4});
//     }
//   });
// }

// /**
//  * This function is used to store the final response of the user in the userFinalStatusByTC table
//  * @param {*} userIds //list of user ids
//  */
// async function finalResponse(activeStatusPhase4Users) {
//   activeStatusPhase4Users.map(async (activeStatus) => {
//     // getting the response of the trusted contacts from the TCResponse table
//     const tCResponseParticularUser = await fetchTCLatestResponses(activeStatus?.userId, activeStatus?.lastLogin);

//     // getting the user data
//     var usersData = await User.findOne({
//       where: { id: activeStatus?.userId },
//       raw: true
//     });
    
//     if (isNill(usersData)) {
//       return;
//     }

//     // getting the user inactive days
//     const userInactiveDays = getUserInactiveDays(activeStatus?.lastLogin);

//     //storing the response of the trusted contacts in a dictionary
//     var TC_unique_response = {};
//     tCResponseParticularUser.map((key) => {
//       TC_unique_response[key?.userId] =
//         key?.response;
//     });

//     //checking for conflicts in the trusted contacts responses
//     //if there is still a conflict then the final is defined by the primary trusted contact

//     if (isConflictPresent(TC_unique_response)) {
//       //getting the primary trusted contact of the user
//       var tC_of_user = await Connection.findOne({
//         where: {
//           userId: activeStatus?.userId,
//           istrusted: true,
//           isDeleted: false,
//           isPrimaryTrustedContact: true,
//           connectionUserId: { [Op.ne]: null },
//         },
//         raw: true
//       });

//       const primaryTCResponse = tC_of_user ? TC_unique_response?.[tC_of_user?.connectionUserId] : 'No Response';
      
//       //storing the final response of the user in the userFinalStatusByTC table
//       await UserFinalStatusByTC.create({
//           userId: activeStatus?.userId,
//           userProvidedStatus: usersData?.status,
//           response: primaryTCResponse,
//       });

//       // NO PRIMARY TRUSTED CONTACT: if no primary trusted contact then send the final email to the user that we will release the data after A1+A2+A3+A4= A5 days
//       // and will not move the user to phase 5 directly
//       if(isNill(tC_of_user)){
//         await cLSIUserHasNoTCEmail(usersData?.email, userInactiveDays-A1, usersData?.name);

//         //updating the email count and email time in the UserActiveStatus table
//         UserActiveStatus.update(
//           {
//             emailCount: activeStatus?.emailCount + 1,
//             emailTime: new Date(),
//           },
//           {
//             where: { userId: activeStatus?.userId },
//           }
//         );
//         return;
//       }

//       // if primary trusted contact did not respond then we will
//       // not move the user to phase 5 but will wait till phase 4 completes
//       if(primaryTCResponse === 'No Response') return;

//       if (primaryTCResponse === "Deceased") {
//         await markUserAsDeceased(activeStatus?.userId);
//       }
//     } else {
//       //if there is no conflict then the final response is defined by the first trusted contact(since all of them are same).
//       const firstValue = Object.values(TC_unique_response)[0];
//       await UserFinalStatusByTC.create({
//         userId: activeStatus?.userId,
//         userProvidedStatus: usersData?.status,
//         response: firstValue,
//       });
//       if (firstValue === "Deceased") {
//         await markUserAsDeceased(activeStatus?.userId);
//       }
//     }

//     // moving user to phase 5
//     // userPhase 5 is defined as the final response is stored and actions should be taken
//     await movingUserToPhase({userId: activeStatus?.userId, userPhase: 5});
//   });
// }

// /**
//  * This function is used to release the data of the users
//  * @param {*} userIds //list of user ids
//  */
// async function releaseData(userIds) {
//   await Promise.allSettled(
//     userIds.map(async (id) => {
//       updateVisibility(id);
//     })
//   );
// }
  
// const updateVisibility = async (id) => {
//   await AllWills.update(
//     {
//       isVisible: true,
//     },
//     {
//       where: { userId: id, isDeleted: false, draft: false },
//     }
//   );
//   await ShareAssets.update(
//     {
//       isVisible: true,
//     },
//     {
//       where: { userId: id, isDeleted: false },
//     }
//   );
//   await AssetDetails.update(
//     {
//       isVisible: true,
//     },
//     {
//       where: { userId: id, isDeleted: false },
//     }
//   );
//   await AssetGroup.update(
//     {
//       isVisible: true,
//     },
//     {
//       where: { userId: id, isDeleted: false },
//     }
//   );
//   return true;
// };

// // This function fetches the latest TC responses for a particular user after the user's last login
// const fetchTCLatestResponses = async (userId, lastLogin) => {
//   // get latest createdAt per user for myConfidantId
//   const latestRecords = await TCResponse.findAll({
//     attributes: [
//       'userId',
//       [sequelize.fn('MAX', sequelize.col('createdAt')), 'latestCreatedAt']
//     ],
//     where: { 
//       myConfidantId: userId,
//       createdAt: {[Op.gte]: lastLogin ? new Date(lastLogin) : new Date(0)}
//     },
//     group: ['userId'],
//     raw: true,
//   });

//   // fetch userId and response records matching latest createdAt per user
//   const tCResponseParticularUser = await TCResponse.findAll({
//     where: {
//       [Op.or]: latestRecords.map(r => ({
//         userId: r.userId,
//         createdAt: r.latestCreatedAt
//       })),
//     },
//     raw: true
//   });

//   return tCResponseParticularUser;
// }


// /**
//  * This function implements the CLSIAlgorithm (Now verilife):
//  * 1. Fetches configuration parameters (A1,A2,A3,A4) and day lists from KeyValuePairs
//  * 2. Finds users in Phase 1 who haven't logged in for 90+ days and are alive/not suspended
//  * 3. For Phase 1 users:
//  *    - If inactive > A1 days and in day_list_phase_1: sends email and updates email count
//  *    - If inactive >= A2+A1 days: moves user to Phase 2
//  * 4. Finds users in Phase 2 who haven't logged in for 90+ days and are alive/not suspended
//  * 5. For Phase 2 users:
//  *    - If inactive > A2+A1+A3 days: moves user to Phase 3
//  *    - If in day_list_phase_2: sends email
//  */
// const cLSIAlgorithmCronJob = async () => {
//   //checking for the right machine
//   // const cronJobMachine = await isCronJobMachine();
//   // if (!cronJobMachine) {
//   //   return;
//   // }
//   console.log(`CLSI Algorithm Cron Job Started ${os.hostname()}`);

//   //initializing the day lists and A1,A2,A3,A4 values
//   await initializeDayLists();

//   //fetching the users who are in phase 1, alive, not suspended and last login is more than 90 days ago
//   var usersActiveData_Phase1 = await UserActiveStatus.findAll({
//     where: {
//       isUserAlive: 1,
//       userPhase: 1,
//       isSuspended: false,
//       lastLogin: {
//         [Op.lte]: new Date(new Date() - 90 * 24 * 60 * 60 * 1000),
//       },
//     },
//   });
//   //fetching the users who are in phase 2, alive, not suspended and last login is more than 90 days ago

//   // users_Phase1 array stores user data for phase 1:
//   // Index 0: User IDs
//   // Index 1: Number of inactive days 
//   // Index 2: User email addresses
//   // Index 3: User names
//   // Index 4: Subscription expired statuses
//   var users_Phase1 = [[], [], [], [], []];

//   // Arrays to store phase 2 user IDs and their inactive days
//   var usersId_Phase2 = [],
//     usersDays_Phase2 = [],
//     usersSubscriptionExpired_Phase2 = [];

//   /**
//    * Phase 1 of the algorithm is called here
//    */
//   if (usersActiveData_Phase1.length > 0) {
//     usersActiveData_Phase1.map(async (key) => {
//       // calculating the number of days user is inactive
//       const userInactiveDays = getUserInactiveDays(key["dataValues"]["lastLogin"]);

//       //checking if the user is inactive for more than A1 days and the user is in the day_list_phase_1
//       if (
//         userInactiveDays > A1 &&
//         day_list_phase_1.has(userInactiveDays - A1)
//       ) {
//         //pushing the user id, days and email count to the users_Phase1 array
//         users_Phase1[0].push(key["dataValues"]["userId"]);
//         users_Phase1[1].push(userInactiveDays - A1);
//         //updating the email count and email time in the UserActiveStatus table
//         await UserActiveStatus.update(
//           {
//             emailCount: key["dataValues"]["emailCount"] + 1,
//             emailTime: new Date(),
//           },
//           {
//             where: { userId: key["dataValues"]["userId"] },
//           }
//         );
//       }

//       // moving user to phase 2
//       // checking if the user is inactive for more than A2 + A1 days and updating the userPhase to 2
//       if (userInactiveDays >= A2 + A1) {
//         await movingUserToPhase({userId: key["dataValues"]["userId"], userPhase: 2})
//       }
//     });
//     //if there are users in phase 1, then sending email to the users
//     if (users_Phase1[0].length > 0) {
//       for (let i = 0; i < users_Phase1[0].length; i++) {
//         var usersData = await User.findOne({
//           where: { id: users_Phase1[0][i] },
//         });
//         users_Phase1[2].push(usersData?.dataValues.email);
//         users_Phase1[3].push(usersData?.dataValues.name);

//         // Check if the user has a latest expired subscription
//         const expiredSubscription = await db.subscriptions.findOne({
//           where: {
//             status: SubscriptionStatus.EXPIRED,
//             userId: users_Phase1[0][i],
//             isDeleted: false
//           },
//           order: [['createdAt', 'DESC']]
//         });

//         if (expiredSubscription) {
//           users_Phase1[4].push(true);
//         } else {
//           users_Phase1[4].push(false);
//         }
//       }
//       await sendEmailPhase1(
//         users_Phase1[0],
//         users_Phase1[1],
//         users_Phase1[2],
//         users_Phase1[3],
//         users_Phase1[4]
//       );
//     }
//   }

//   //fetching the users who are in phase 2 or phase 3, alive, not suspended and last login is more than 90 days ago
//   // phase 2 users are those who have at least one TC responded
//   // phase 3 users are those who have atleast one TC responded and are in conflict resolution phase
//   var usersActiveData_Phase2 = await UserActiveStatus.findAll({
//     where: {
//       isUserAlive: 1,
//       userPhase: {[Op.in]: [2,3]}, // Including users in both Phase 2 and Phase 3
//       isSuspended: false,
//       lastLogin: {
//         [Op.lte]: new Date(new Date() - 90 * 24 * 60 * 60 * 1000),
//       },
//     },
//   });

//   //if there are users in phase 2, then sending email to the users
//   if (usersActiveData_Phase2.length > 0) {
//     await Promise.all(usersActiveData_Phase2.map(async (key) => {
//       // calculating the number of days user is inactive
//       const userInactiveDays = getUserInactiveDays(key["dataValues"]["lastLogin"]);

//       // checking if the user is inactive for more than A2 + A1 + A3 days and updating the userPhase to 4
//       if (userInactiveDays >= A2 + A1 + A3) {
//         // moving user to phase 4
//         await movingUserToPhase({userId: key["dataValues"]["userId"], userPhase: 4});
//       } else if (day_list_phase_2.has(userInactiveDays - A1)) {
//         //user days is the number of days user is inactive after A1 days of phase 2
//         usersId_Phase2.push(key["dataValues"]["userId"]);
//         usersDays_Phase2.push(userInactiveDays - A1);

//         // Check if the user has a latest expired subscription
//         const expiredSubscription = await db.subscriptions.findOne({
//           where: {
//             status: SubscriptionStatus.EXPIRED,
//             userId: key["dataValues"]["userId"],
//             isDeleted: false
//           },
//           order: [['createdAt', 'DESC']]
//         });

//         if (expiredSubscription) {
//           usersSubscriptionExpired_Phase2.push(true);
//         } else {
//           usersSubscriptionExpired_Phase2.push(false);
//         }

//       }
//     }));
//     //if there are users in phase 2, then sending email to the users
//     if (usersId_Phase2.length > 0) {
//       await sendEmailPhase2(usersId_Phase2, usersDays_Phase2, usersSubscriptionExpired_Phase2);
//     }
//   }

//   const usersActiveData_Phase4 = await UserActiveStatus.findAll({
//     where: {
//       isUserAlive: 1,
//       userPhase: 4,
//       isSuspended: false,
//       lastLogin: {
//         [Op.lte]: new Date(new Date() - 90 * 24 * 60 * 60 * 1000),
//       },
//     },
//   });

//   //if there are users in phase 4, then sending email to the users
//   if (usersActiveData_Phase4.length > 0) {
//     usersActiveData_Phase4.map(async (key) => {
//       // calculating the number of days user is inactive
//       const userInactiveDays = getUserInactiveDays(key["dataValues"]["lastLogin"]);

//       //checking if the user is inactive for more than A2 + A1 + A3 days and updating the userPhase to 5
//       if (userInactiveDays >= A2 + A1 + A3 + A4) {
//         // moving the user to phase 5
//         await movingUserToPhase({userId: key["dataValues"]["userId"], userPhase: 5});

//         // delete user data
//         await UserActiveStatus.update(
//           { isSuspended: true },
//           {
//             where: { userId: key["dataValues"]["userId"] },
//           }
//         );

//         await deleteUserDataByUserId(key["dataValues"]["userId"]);
//       }
      
//       // NO RESPONSE FROM USER OR TRUSTED CONTACTS: send the final email on 241st day to the user that we will release the data after A1+A2+A3+A4= A5 days
//       else  if(userInactiveDays === A2 + A1 + A3 + 1) {
//         const userData = await User.findOne({
//           where: { id: key["dataValues"]["userId"] },
//         });

//         if (isNill(userData)) {
//           return;
//         }
        
//         await cLSIFinalMessageToUserEmail(userData.dataValues.email, userInactiveDays-A1, userData.dataValues.name);

//         //updating the email count and email time in the UserActiveStatus table
//         UserActiveStatus.update(
//           {
//             emailCount: key["dataValues"]["emailCount"] + 1,
//             emailTime: new Date(),
//           },
//           {
//             where: { userId: key["dataValues"]["userId"] },
//           }
//         );
//       }
//     });
//   }
// };

// async function checkingTCResponseCronJob() {
//   //checking for the right machine
//   const cronJobMachine = await isCronJobMachine();
//   if (!cronJobMachine) {
//     return;
//   }
//   console.log(`Checking TC Response Cron Job Started ${os.hostname()}`);

//   //initializing the day lists and A1,A2,A3,A4 values
//   await initializeDayLists();

//   //getting the users who are in phase 1 and have responded to the email in the last 24 hours
//   const twentyFourHoursAgo = moment().subtract(24, "hours").toDate();
//   var tC_responded_own = await TCResponse.findAll({
//     where: {
//       myConfidantCurrentPhase: 1,
//       createdAt: {
//         [Op.gte]: twentyFourHoursAgo,
//       },
//       isValidTC: true,
//     },
//   });

//   // getting the users who are in phase 3 and are alive
//   var conflictEmailUser = await UserActiveStatus.findAll({
//     where: {
//       userPhase: 3,
//       isUserAlive: true,
//     },
//     raw: true
//   });

//   // getting the users who are in phase 4 and are alive
//   var finalStatusOfUser = await UserActiveStatus.findAll({
//     where: {
//       userPhase: 4,
//       isUserAlive: true,
//     },
//     raw: true
//   });

//   //checking the final response of the users who are in phase 4 and moving them to phase 5
//   if(finalStatusOfUser && finalStatusOfUser.length > 0) await finalResponse(finalStatusOfUser);
//   //resolving the conflict of the users who are in phase 3
//   if(conflictEmailUser && conflictEmailUser.length > 0) await conflictResolve(conflictEmailUser);
//   //checking if the user has responded to the email in the last 24 hours
//   tC_responded_own.map(async (key) => {
//     //checking if the user has a trusted connection with the user who has responded to the email
//     var isTCAvailable = await Connection.findOne({
//       where: {
//         connectionUserId: key["dataValues"]["userId"],
//         userId: key["dataValues"]["myConfidantId"],
//         istrusted: true,
//       },
//     });
//     if (isTCAvailable) {
//       //sending email to the other trusted contact
//       sendEmailToOtherTc(
//         key["dataValues"]["myConfidantId"],
//         key["dataValues"]["userId"]
//       );
//     } else {
//       //if the user trusted contact is not valid anymore(like: user has changed the trusted contact) then updating the isValidTC to false
//       await TCResponse.update(
//         { isValidTC: false },
//         {
//           where: {
//             id: key["dataValues"]["id"],
//           },
//         }
//       );
//     }
//   });
// }

// const checkingUserReleaseCronJob = async () => {
//   //checking for the right machine
//   const cronJobMachine = await isCronJobMachine();
//   if (!cronJobMachine) {
//     return;
//   }
//   console.log(`Checking User Release Cron Job Started ${os.hostname()}`);

//   const twentyFourHoursAgo = moment().subtract(24, "hours").toDate();

//   //fetching the users whoose final status has been defined as terminally ill in the last 24 hours and the user status is also terminally ill
//   var user_final_ter_ill_provided_ter_ill = await UserFinalStatusByTC.findAll({
//     where: {
//       response: "Terminally ill",
//       createdAt: {
//         [Op.gte]: twentyFourHoursAgo,
//       },
//       isCurrentlyValid: true,
//     },
//   });

//   //fetching the users whoose final status has been defined as deceased in the last 24 hours
//   var user_final_deceased = await UserFinalStatusByTC.findAll({
//     where: {
//       response: "Deceased",
//       createdAt: {
//         [Op.gte]: twentyFourHoursAgo,
//       },
//       isCurrentlyValid: true,
//     },
//   });

//   //creating two arrays to store the user ids of the users whoose id needs to be released and deleted
//   var userId_release_data = [];

//   //adding the user ids of the users whoose final status has been defined as deceased
//   user_final_deceased.map((key) => {
//     userId_release_data.push(key["dataValues"]["userId"]);
//   });

//   //adding the user ids of the users whoose final status has been defined as terminally ill
//   user_final_ter_ill_provided_ter_ill.map((key) => {
//     userId_release_data.push(key["dataValues"]["userId"]);
//   });

//   // removing duplicate users from the arrays
//   userId_release_data = [...new Set(userId_release_data)];

//   // releasing the data of the users
//   await releaseData(userId_release_data);
// }



// /**
//  * Sets the cron job host name in the KeyValuePairs table.
//  * This function must be called before any cron job is executed to avoid race conditions.
//  * It stores the current hostname in the database to track which machine is running the cron jobs.
//  */
// const setCronJobHost = async () => {
//   try {
//     // Assuming KeyValuePairs is your Sequelize model
//     const [record, created] = await KeyValuePairs.findOrCreate({
//       where: {
//         category: "cron_job_machine",
//       },
//       defaults: {
//         value: os.hostname(),
//       },
//     });

//     // If the record already exists, update its value
//     if (!created) {
//       await KeyValuePairs.update(
//         { value: os.hostname() },
//         {
//           where: {
//             category: "cron_job_machine",
//           },
//         }
//       );
//     }
//   } catch (error) {
//     console.log(error.message);
//   }
// };

// const draftScheduling = async () => {
//   try {
//     // this is line prevent executing more than one method at a time
//     const cronJobMachine = await isCronJobMachine();
//     if (!cronJobMachine) {
//       return;
//     }
//     console.log("Draftscheduling started running requestType : cronjob")
//     // getting ,minimumdraftperiod frim categorykey value table
//     const willDraftPeriod = await CategoryKeyValue.findOne({
//       where: {
//         category: "draftwill",
//         key: "minimumDraftPeriod",
//       },
//       attributes: ['value']
//     })
//     const minimumDraftPeriod = parseInt(willDraftPeriod["dataValues"].value);
//     // getting popupphasedays frim categorykey value table

//     const willPhaseDays = await CategoryKeyValue.findOne({
//       where: {
//         category: "draftwill",
//         key: "popupPhaseDays",
//       },
//       attributes: ['value']
//     })
//     const popupPhaseDays = parseInt(willPhaseDays["dataValues"].value);
//     const allDraftWills = await DraftWills.findAll({
//       where: {
//         isDeleted: false,
//       },
//       attributes: ['lastPhasePopupDays', 'isPopupShown'],
//       include: [
//         {
//           model: AllWills,
//           as: 'ewWill',
//           attributes: ['id', 'userId', 'draft', 'updatedAt'],
//           required: false,
//         },
//       ],
//     });
//     // combining two table info in one object
//     let combinedData = allDraftWills.map(draftWill => {
//       return {
//         ...draftWill.dataValues,
//         ...draftWill.ewWill.dataValues
//       };
//     });

//     // this logic has been written for filtering out premium userIds as there is no draft deletion business logic on them.
//     // in future just update the filterNonPremiumUsers helper function.
//     const draftWillsUserIds = combinedData.map((data) => data['userId']);
//     const filteredIds = await filterNonPremiumUsers(draftWillsUserIds);

//     // skipping the premium userIds in the combinedData array
//     combinedData = combinedData.filter((data) => filteredIds.includes(data['userId']))

//     const currentTime = new Date().getTime();
//     // Iterate through the data and calculate the time difference in days
//     for (let i = 0; i < combinedData.length; i++) {
//       const updatedAtTimestamp = new Date(combinedData[i].updatedAt).getTime();
//       const timeDifference = currentTime - updatedAtTimestamp;
//       const days = Math.floor(timeDifference / (1000 * 60 * 60 * 24));
//       //  just delete the drafts if updated data is 45 days above 
//       if (days > minimumDraftPeriod) {
//         const willType = await AllWills.findOne({
//           where: {
//             userId: combinedData[i].userId,
//             id: combinedData[i].id
//           },
//           attributes: ["type"]
//         })

//         if (willType) {


//           if (willType.dataValues.type === 'text') {
//             const textwill = await AllWills.findOne({
//               where: { id: combinedData[i].id, isDeleted: false },
//               attributes: ["userId", "description"],
//             });
//             //perform storage update check
//             if (textwill && textwill.description && textwill.description.includes("insert")) {
//               const data = JSON.parse(textwill.description);

//               const sizePromises = data.map(async (obj) => {
//                 if (Object.hasOwn(obj, "insert")) {
//                   if (
//                     Object.hasOwn(obj.insert, "image") &&
//                     isValidAzureUrl(obj.insert.image)
//                   ) {
//                     let computedSize = await getBlobSizeFromUrl(obj.insert.image);
//                     return computedSize !== null ? computedSize : 0;
//                   }
//                 }
//                 return 0;
//               });
//               const sizes = await Promise.all(sizePromises);
//               const totalSize = sizes
//                 .reduce((acc, size) => acc + Number(size), 0)
//                 .toFixed(2);
//               //perform storage update check
//               await updateStorageSizeById(combinedData[i].id, -1 * totalSize, "Ew");
//             }

//           } else if (willType.dataValues.type === 'audio') {
//             const audioWill = await AllWills.findOne({
//               where: { id: combinedData[i].id, isDeleted: false },
//               attributes: ["userId", "link"],
//             });

//             if (audioWill && audioWill.link) {
//               //get size from blob
//               if (isValidAzureUrl(audioWill.link)) {
//                 const size = await getBlobSizeFromUrl(audioWill.link);
//                 //perform storage update check
//                 const sizeDiff = -1 * size;
//                 await updateStorageSizeById(combinedData[i].userId, sizeDiff, "Ew");
//               }
//             }
//           } else if (willType.dataValues.type === 'video') {

//             const videowill = await AllWills.findOne({
//               where: { id: combinedData[i].id, isDeleted: false },
//               attributes: ["userId", "size"],
//             });
//             //perform storage update check
//             if (videowill && videowill.size) {
//               const sizeDiff = -1 * videowill.size
//               await updateStorageSizeById(combinedData[i].userId, sizeDiff, "Ew");
//             }


//           }
//         }

//         await AllWills.update({
//           isDeleted: true
//         },
//           {
//             where: {
//               userId: combinedData[i].userId,
//               id: combinedData[i].id
//             },
//           })
//         await EwMultipleRecipients.update(
//           { isDeleted: true },
//           {
//             where: {
//               willId: combinedData[i].id,
//               userId: combinedData[i].userId
//             },
//           }
//         );
//         // await DraftWills.destroy({
//         //   where: {
//         //     userId: combinedData[i].userId,
//         //     willId: combinedData[i].id
//         //   }
//         // });
//         await DraftWills.update(
//           {
//             isDeleted: true
//           },
//           {
//             where: {
//               userId: combinedData[i].userId,
//               willId: combinedData[i].id
//             },
//           },
//         )
//       }
//       // if difference days divide popupphasedays is more than last popup shown days divide popupphaasedays this means present day is in different
//       //  phase and last popup shown days is in different phase, show update lastPhasePopupPhaseDays to shown pop up in lastest phase

//       else if (!combinedData.isPopupShown && (findDraftRange(days, popupPhaseDays) > findDraftRange(combinedData[i].lastPhasePopupDays, popupPhaseDays))) {
//         await DraftWills.update({
//           isPopupShown: true,
//           lastPhasePopupDays: days
//         },
//           {
//             where: {
//               userId: combinedData[i].userId,
//               willId: combinedData[i].id
//             }
//           }
//         );
//       }
//     }

//     console.log("Draftscheduling ended running requestType : cronjob")
//   } catch (error) {
//     console.log("Error occurred in cronjob : draftScheduling")
//   }
// }

// const ewDraftEmailScheduling = async () => {
//   try {
//     // this is the line to prevent excuting more than one method at a time
//     const cronJobMachine = await isCronJobMachine();
//     if (!cronJobMachine) {
//       return;
//     }
//     console.log("Draft Email Scheduling started running requestType : cronjob");
//     // getting emotional will reminder days from CategoryKeyValues table
//     const reminderDaysValue = await CategoryKeyValue.findAll({
//       where: {
//         category: "emotionalwilldraft",
//         key: "EMOTIONAL_DRAFT_REMINDER",
//       },
//       attributes: ['value']
//     });
//     const reminderDays = [];
//     for (var value of reminderDaysValue) {
//       const day = parseInt(value['dataValues'].value);
//       reminderDays.push(day);
//     }
//     // extracted reminder days
//     // fetching EW draft data from DraftWills table
//     const allDraftWills = await DraftWills.findAll({
//       where: {
//         isDeleted: false,
//       },
//       attributes: ['createdAt', 'userId'],
//     });
//     const userIdAndCreatedAt = [];
//     for (var data of allDraftWills) {
//       const userId = data['dataValues'].userId;
//       const timeStamp = data['dataValues'].createdAt;
//       const currentDateTime = new Date();
//       const createdDateTime = new Date(timeStamp);

//       const currentDate = new Date(currentDateTime.getFullYear(), currentDateTime.getMonth(), currentDateTime.getDate());
//       const createdDate = new Date(createdDateTime.getFullYear(), createdDateTime.getMonth(), createdDateTime.getDate());

//       const daysSinceDraftCreated = Math.ceil((currentDate - createdDate) / (1000 * 60 * 60 * 24));
//       userIdAndCreatedAt.push({
//         userId: userId,
//         daysSinceDraftCreated: daysSinceDraftCreated
//       });
//     }
//     const emailsToSend = userIdAndCreatedAt.filter((userObject) => {
//       return reminderDays.includes(userObject.daysSinceDraftCreated);
//     });

//     const userMap = emailsToSend.reduce((map, item) => {
//       if (!map.has(item.userId)) {
//         map.set(item.userId, new Set());
//       }
//       map.get(item.userId).add(item.daysSinceDraftCreated);
//       return map;
//     }, new Map());


//     // got userId's who's drafts needs to send reminders
//     // getUserName and email from the userId
//     let userIdArray = new Set();
//     for (var user of emailsToSend) {
//       userIdArray.add(user.userId);
//     }
//     let userIdArray2 = Array.from(userIdArray);
//     let users = await User.findAll({
//       where: {
//         Id: {
//           [Op.in]: userIdArray2
//         }
//       },
//       attributes: ['id', 'name', 'email']
//     });

//     // this logic has been written for filtering out premium userIds as there is no draft deletion business logic on them.
//     // in future just update the filterNonPremiumUsers helper function.
//     let filteredUserIds = await filterNonPremiumUsers(users.map((user) => user['dataValues']['id']));
//     users = users.filter((user) => filteredUserIds.includes(user['dataValues']['id']));
//     const finalArr = [];
//     for (var user of users) {
//       finalArr.push({
//         "userId": user.dataValues.id,
//         "name": user.dataValues.name,
//         "email": user.dataValues.email,
//         "days": Array.from(userMap.get(user.dataValues.id))
//       });
//     }

//     const emailPromises = [];

//     for (const user of finalArr) {
//       for (const day of user.days) {
//         emailPromises.push(
//           (async () => {
//             try {
//               await sendEWDraftRemainderEmails(day, user.name, user.email);
//               console.log(`Email sent to ${user.email} for day ${day}`);
//             } catch (error) {
//               console.error(`Failed to send email to ${user.email} for day ${day}:`, error);
//             }
//           })
//         );
//       }
//     }

//     // Execute all email promises after pushing the function references
//     await Promise.allSettled(emailPromises.map(promiseFn => promiseFn()));
//     return emailsToSend;
//   } catch (error) {
//     console.log(`Error occured in cronjob : ewDraftEmailScheduling ${error}`);
//   }
// }

// // fuction to calculate the range
// const findDraftRange = (days, popupPhaseDays) => {
//   if (!days) return 0;
//   return Math.floor(days / popupPhaseDays)
// }

// // function to send hybrid email notifications based on the number of days the user is inactive
// const sendHybridEmailNotifications = async ({email, days, username1, username2, isConflict}) => {
//   if(days > A1 && days <= A1 + 50){
//     await hybridCLSI_Day_01_50_EmailNotification(
//       email,
//       days,
//       username1
//     );
//   } else if(days > A1 + 50 && days < A1 + A2){
//     const daysLeft = A1 + A2 - days;

//     await hybridCLSI_Day_60_80_EmailNotification(
//       email,
//       daysLeft,
//       username1
//     );
//   } else if(days === A1 + A2) {
//     await hybridCLSI_Day_90_EmailNotification(
//       email,
//       days,
//       username1
//     );
//   } else if(days >= A1 + A2 + 1 && days <= A1 + A2 + 20) { 
//     await hybridCLSI_Day_91_110_EmailNotification(
//       email,
//       username1,
//       username2
//     );
//   } else if(days > A1 + A2 + 20) {
//     const daysLeft = days - (A1 + A2 + A3);

//     await hybridCLSI_Day_120_140_EmailNotification(
//       email,
//       daysLeft,
//       username1,
//       username2
//     );
//   } else if(days === A1 + A2 + A3) {
//     await hybridCLSI_Day_150_EmailNotification(
//       email,
//       username1,
//       username2
//     );
//   } else if(isConflict) {
//     await hybridCLSI_Conflict_EmailNotification(
//       email,
//       username1,
//       username2
//     )
//   }
// }
// const autoTransferOfAdminRightsCronJob = async () => {
//   try {
//     const collaborations = await db.collaborationModel.findAll({
//       where: { isDeleted: false },
//       attributes: ["id", "collaborationName"],
//     });

//     for (const collab of collaborations) {
//       const collaborationId = collab.id;

//       // =====================================================
//       // 🔍 1. Calculate Backup Eligibility BEFORE doing anything
//       // =====================================================

//       // Eligible members (>=200 AND != 400)
//       const allowBackupAdmin = await db.collaborationMember.findAll({
//         where: {
//           collaborationId,
//           access_type: { [Op.gte]: 200, [Op.ne]: 400 },
//           isDeleted: false,
//         },
//         raw: true,
//       });

//       // Count ACTIVE primary admins
//       const availableAdmins = await db.collaborationMember.findAll({
//         where: {
//           collaborationId,
//           access_type: 400,
//           isDeleted: false,
//         },
//         raw: true,
//       });

//       let adminCount = 0;
//       for (const admin of availableAdmins) {
//         const adminStatus = await db.users.findOne({
//           where: {
//             id: admin.userId,
//             status: { [Op.in]: ["Alive and Kickin", "Alive & Kickin'", "Alive and Kickin'"] },
//             isDeleted: false,
//           },
//           raw: true,
//         });
//         if (adminStatus) adminCount++;
//       }

//       // Count unique members who shared assets
//       const assets = await db.collaborationModule.findAll({
//         where: { collaborationId, isDeleted: false },
//         raw: true
//       });

//       const moduleIds = assets.map(a => a.moduleId);
//       const owners = [];

//       for (const assetId of moduleIds) {
//         const assetOwner = await db.assetOwnerV2.findOne({
//           where: { assetId, isDeleted: false },
//           raw: true
//         });
//         if (assetOwner) owners.push(assetOwner.userId);
//       }

//       const uniqueUsers = [...new Set(owners)];
//       const member_count = uniqueUsers.length;

//       // =====================================================
//       // If NOT eligible → SKIP this collaboration group
//       // =====================================================
//       if (!allowBackupAdmin.length >0 || !adminCount === 1 || !member_count >=2) {
//         console.log(`Skipping group ${collaborationId} — Not eligible`);
//         continue;
//       }

//       // =====================================================
//       // 2. Process Admin Transfers NOW (Eligible only)
//       // =====================================================

//       const admins = await db.collaborationMember.findAll({
//         where: {
//           collaborationId,
//           access_type: 400,
//           isBackupAdmin: false,
//           isDeleted: false,
//         },
//       });

//       for (const admin of admins) {
//         const adminUser = await db.users.findOne({
//           where: { id: admin.userId, isDeleted: false },
//         });

//         const userStatus = await db.userActiveStatus.findOne({
//           where: { userId: admin.userId },
//         });

//         const accountDelete = await db.deleteSuspendAccount.findOne({
//           where: { userId: admin.userId },
//         });

//         const getEligibleMembers = async () =>
//           await db.collaborationMember.findAll({
//             where: {
//               collaborationId,
//               access_type: { [Op.gte]: 200, [Op.lte]: 300 },
//               isDeleted: false,
//             },
//             include: [{ model: db.users, as: "user", attributes: ["name"] }],
//           });

//         const promoteToAdmin = async (member, message) => {
//           await db.collaborationMember.update(
//             { access_type: 400, isBackupAdmin: false },
//             { where: { id: member.id } }
//           );

//           if (member.userId) {
//             await db.inAppNotification.create({
//               notificationTitle: "You have been promoted to Admin",
//               notificationBody: message,
//               userId: member.userId,
//               connectionUserId: member.userId,
//               connectionId: member.connectionId,
//               collaborationId,
//               isViewed: false,
//             });
//           }
//         };

//         const assignBackupAdmin = async (member, message) => {
//           await db.collaborationMember.update(
//             { isBackupAdmin: true },
//             { where: { id: member.id } }
//           );

//           if (member.userId) {
//             await db.inAppNotification.create({
//               notificationTitle: "You are assigned as Backup Admin",
//               notificationBody: message,
//               userId: member.userId,
//               connectionUserId: member.userId,
//               connectionId: member.connectionId,
//               collaborationId,
//               isViewed: false,
//             });
//           }
//         };

//         const findMostEligible = (list) => {
//           if (!list.length) return null;
//           return list.reduce((best, cur) => {
//             if (cur.access_type > best.access_type) return cur;
//             if (
//               cur.access_type === best.access_type &&
//               new Date(cur.createdAt) < new Date(best.createdAt)
//             ) {
//               return cur;
//             }
//             return best;
//           });
//         };

//         // 1️⃣ Posthumous case
//         if (userStatus?.isUserAlive === false) {
//           const eligible = await getEligibleMembers();
//           const best = findMostEligible(eligible);
//           if (best) {
//             await promoteToAdmin(
//               best,
//               `You have been assigned as the Admin of the "${collab.collaborationName}" Collaboration Group as the previous Admin is inactive.`
//             );
//           }
//         }

//         // 2️⃣ Account suspended/deleted
//         if (userStatus?.isSuspended || accountDelete?.isDeleted) {
//           const eligible = await getEligibleMembers();
//           const best = findMostEligible(eligible);
//           if (best) {
//             await promoteToAdmin(
//               best,
//               `You have been assigned as the Admin of the "${collab.collaborationName}" Collaboration Group because the previous Admin is inactive.`
//             );
//           }
//         }

//         // 3️⃣ Terminally ill → assign backup admin
//         if (adminUser?.status === "Terminally ill" || adminUser?.status === "Terminally Ill") {
//           const eligible = await getEligibleMembers();
//           const best = findMostEligible(eligible);
//           if (best) {
//             await assignBackupAdmin(
//               best,
//               `You have been assigned as Backup Admin of "${collab.collaborationName}".`
//             );
//           }
//         }
//       }
//     }
//   } catch (error) {
//     console.error("❌ Cron Job Error:", error);
//   }
// };




// const setCronJobMachine = async () => {
//   try {
//     cron.schedule("0 0 * * *", setCronJobHost);
//     cron.schedule("5 0 * * *", cLSIAlgorithmCronJob);
//     cron.schedule("10 0 * * *", setCronJobHost);
//     deleteAccountAfterDeletionPeriod();
//     cron.schedule("20 0 * * *", setCronJobHost);
//     cron.schedule("25 0 * * *", checkingTCResponseCronJob);
//     cron.schedule("30 0 * * *", setCronJobHost);
//     cron.schedule("35 0 * * *", checkingUserReleaseCronJob);
//     cron.schedule("40 0 * * *", setCronJobHost);
//     cron.schedule("45 0 * * *", draftScheduling);
//     cron.schedule("55 0 * * *", ewDraftEmailScheduling);
//     cron.schedule("0 1 * * *", setCronJobHost);
//     cron.schedule("5 1 * * *", deleteScheduledAssets);
//     cron.schedule("10 1 * * *", setCronJobHost);
//     // This cron job sends an email notification to users whose subscription is set to expire in 7 days.this is for montly paln remainders
//     cron.schedule("15 1 * * *", renewalEmailNoticationsMonthly);
//     cron.schedule("20 1 * * *", setCronJobHost);
//     // This cron job sends an email notification to users whose subscription is set to expire in 30 days. this is for yearly paln remainders
//     cron.schedule("25 1 * * *", renewalEmailNoticationsYearly);
//     cron.schedule("30 1 * * *", setCronJobHost);
//     // // This cronjob is for sending the email notifications to the users who's grace period is ending in 45 days at different intervals
//     cron.schedule("35 1 * * *", gracePeriodEmailNotications);

//     cron.schedule("40 1 * * *", setCronJobHost);
//     cron.schedule("45 1 * * *", autoTransferOfAdminRightsCronJob);
//     cron.schedule("0 2 * * *", setCronJobHost);
//     cron.schedule("5 2 * * *", triggerTransactionForUpcomingMandates);
//     cron.schedule("10 2 * * *", setCronJobHost);
//     cron.schedule("15 2 * * *", generateInvoicesForUpcomingMandates);
//     cron.schedule("20 2 * * *", setCronJobHost);
//     cron.schedule("25 2 * * *", processCancelledSubscriptionsForExpiry);
//     cron.schedule("35 7 * * *", setCronJobHost);
//     cron.schedule("40 7 * * *", notificationsCron);
//     // cronjob for transferOf Admin rights in collaboration module
//   } catch (error) { 
//     console.log(error.message);
//   }
// };

// module.exports = {
//   setCronJobMachine,
//   cLSIAlgorithmCronJob,
//   checkingTCResponseCronJob,
//   checkingUserReleaseCronJob,
//   setCronJobHost,
//   ewDraftEmailScheduling,
//   // autoTransferOfAdminRightsCronJob
// };
