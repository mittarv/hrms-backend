import { setCronJobHost } from "./../../cron";
const cron = require("node-cron");
import { db, dbOutput } from "../../models/index";
import {
  FirstLevelReferralTrackClass,
  newValidUsersClass,
  UserReferralDetailsClass,
  SecondLevelReferralTrackClass,
  UserDetailsClass,
  DailyReferralCountsClass,
  partnerReferralTrackClass
} from "./../classes/referralClasses";
import {
  IUserReferralDetails,
  INewAssets,
  INewWills,
  IPastValidUsers,
  IReferralTrack,
  IUserDetails,
  IDailyReferralCounts,
  IParnerReferralCodes,
  IPMultiReferralCodes
} from "./../Interfaces/referralInterfaces";
import { Op, Sequelize, where } from "sequelize";
const Users = db.users;
const AllWills = db.allwills;
const UserAssetDetails = db.userAssetDetails;
const UserReferralDetails = db.userReferralModel;
const CategoryKeyValuePair = db.categoryKeyValue;
const ReferralTrack = dbOutput.referralTrackModel;
const DailyReferralCount = dbOutput.dailyReferrals;

// Partners model
const Partners = db.partner;
const PartnerReferralTrackModel = dbOutput.partnerReferralTrackModel;
const partnerReferralCode = db.partnerReferralCode;
export const referralPipeline = async () => {

  // HELPER FUNCCC:
  const storeTheMinimumDateForAssetOrWill = (entries: { userId: number; createdAt: Date }[]) => {
    for (const entry of entries) {
      const existingDate = userCreatedAtMap.get(entry.userId);
      const entryDate = new Date(entry.createdAt);

      if (!existingDate || entryDate < existingDate) { // ENSURES THAT WE TAKE THE LOWEST DATE ON THAT DAY INCASE USER CREATED MUTIPLE ASSETS/WILLS
        userCreatedAtMap.set(entry.userId, entryDate);
      }
    }
  };
  // Fetch last copied IDs
  const [lastCopiedAssetId, lastCopiedWillId] = await Promise.all([
    CategoryKeyValuePair.findOne({
      attributes: ['value'],
      where: {
        category: "cron_last_copied_records",
        key: "referral_cron_last_copied_assetId"
      }
    }),
    CategoryKeyValuePair.findOne({
      attributes: ['value'],
      where: {
        category: "cron_last_copied_records",
        key: "referral_cron_last_copied_willId"
      }
    })
  ]);

  const lastAssetId = lastCopiedAssetId?.value || 0;// fallbacking to zero
  const lastWillId = lastCopiedWillId?.value || 0;// fallbacking to zero

  // Fetch data concurrently
  const [newAssets, newWills, pastValidUserIdsRaw] = await Promise.all([
    UserAssetDetails.findAll({
      attributes: ['id', 'userId', 'createdAt'],
      where: {
        id: { [Op.gt]: lastAssetId }
      }
    }) as Promise<INewAssets[]>,

    AllWills.findAll({
      attributes: ['id', 'userId', 'createdAt'],
      where: {
        id: { [Op.gt]: lastWillId } // using gt so that we dont process the last copied asset
      }
    }) as Promise<INewWills[]>,

    ReferralTrack.findAll({
      attributes: ['userId', 'referredId'],
    }) as Promise<IPastValidUsers[]>
  ]);

  // Process the fetched data (e.g., update, filter, etc.)
  if (newAssets.length > 0) {
    // Update last copied asset ID
    await CategoryKeyValuePair.update(
      { value: newAssets[newAssets.length - 1].id },
      {
        where: {
          category: "cron_last_copied_records",
          key: "referral_cron_last_copied_assetId"
        }
      }
    );
  }

  if (newWills.length > 0) {
    // Update last copied will ID
    await CategoryKeyValuePair.update(
      { value: newWills[newWills.length - 1].id },
      {
        where: {
          category: "cron_last_copied_records",
          key: "referral_cron_last_copied_willId"
        }
      }
    );
  }

  const userCreatedAtMap = new Map<number, Date>();

  // Process both datasets
  storeTheMinimumDateForAssetOrWill(newAssets);
  storeTheMinimumDateForAssetOrWill(newWills);

  // NOW BASED ON THE ASSETS WE HAVE GOT WE CREATE A SET OF THE USERIDS WHICH HAVE EITHER ONE ASSET OR ONE WILL
  const ValidUserIds = Array.from(
    new Set([...newAssets.map(asset => asset.userId), ...newWills.map(will => will.userId)])
  ).map(userId => new newValidUsersClass(userId));

  // THIS ARE THE USERIDS WHICH ARE ALREADY PRESENT IN THE REFERRAL TRACK TABLE MEANING THAT THESE USERS REFERRAL WAS ALREADY CALCULATED.....!
  const pastUserIdsSet = new Set(pastValidUserIdsRaw.map(pastUser => pastUser.referredId));

  // WE REMOVE THESE IDS FROM THE ValidUserIds TO FORM "newValidUserIds" WHICH ULTIMATELY MEANS NEW REFERRALS
  const newValidUserIds = ValidUserIds.filter(validUser =>
    !pastUserIdsSet.has(validUser.userId)
  );

  // NOW WE FIND THE USER DETAILS OF ALL THESE "newValidUserIds" TO GET THE REFERRALCODE FORM WHOME THEY WERE REFERRED
  const newUserDetailsRaw = await Users.findAll({
    where: {
      id: newValidUserIds.map(user => user.userId),
    }
  }) as IUserDetails[];

  // POPULATING THE CLASS
  const newUserDetails = newUserDetailsRaw.map(userDetails =>
    new UserDetailsClass(userDetails)
  )

  // NOW WE CREATE A ARRAY OF ALL THE REFERRAL CODES IN THE NEWUSERDETAILS AND THEN FETCH ALL THE ENTRIES FROM THE UserReferralDetails TABLE TO KNOW WHO WAS THE GUY WHO REFERRED THIS PERSON
  const newReferralCodes = newUserDetails.map(userDetail =>
    userDetail.referredBy
  )

  const userReferralDetailsRaw = await UserReferralDetails.findAll({
    where: {
      referralCode: newReferralCodes
    }
  }) as IUserReferralDetails[];
  // POPULATING THE CLASS
  const userReferralDetails = userReferralDetailsRaw.map(userReferralDetailRaw =>
    new UserReferralDetailsClass(userReferralDetailRaw)
  )

  // NOW THE GOAL IS TO POPULATE THE CLASS FirstLevelReferralTrackClass by iterating over all the users and finding the userId from the user table to whome the userId Belongs and add them as refereeId
  const firstLevelReferralTracks = (await Promise.all(
    newUserDetails.map(async (userDetail) => {
      const referralData = userReferralDetails.find(referral => referral.referralCode === userDetail.referredBy);
      if (!referralData) return null; // Skip if referralData is undefined

      const createdAt = userCreatedAtMap.get(userDetail.id) || new Date();
      // Fetch userDetails asynchronously
      const userDetails = await Users.findOne({
        where: { id: referralData.userId }
      }) as IUserDetails | null;

      return new FirstLevelReferralTrackClass({
        userId: referralData.userId,
        firstLevel: true,
        secondLevel: false,
        referredId: userDetail.id,
        referralCode: referralData.referralCode,
        isProcessed: false,
        isEmployee: userDetails ? userDetails.email.includes("@mittarv.com") : false,
        createdAt: createdAt
      });
    })
  ))
    .filter((track): track is FirstLevelReferralTrackClass => track !== null); // Type-safe filter


  await Promise.all(
    firstLevelReferralTracks.map(async (referralDetail) => {
      await ReferralTrack.create(
        referralDetail,
      );
    })
  );

  // AT TIME POINT IN TIME WE HAVE PUSHED NEW DATA INTO THE REFERRAL TRACK TABLE AND WE NOW HAVE NEW REFERRAL DETAIL AS WELL AS THE COMPLETE REFERRAL TRACK TABLE. 
  // A SELF JOIN ON THE referraltrack rt1.userId = rt2.refereeid will give us the second level referrals. 
  // WE are going to do similar type of thing now 


  const possibleSecondLevel = await ReferralTrack.findAll({
    where: {
      referredId: firstLevelReferralTracks.map(referralDetails => referralDetails.userId),
      secondLevel: false
    }
  }) as IReferralTrack[];

  const secondLevelReferralTracks = (await Promise.all(
    firstLevelReferralTracks.map(async (firstLevelReferral) => {
      const referralDataSecondLevel = possibleSecondLevel.find(
        referral => referral.referredId === firstLevelReferral.userId
      );

      if (!referralDataSecondLevel) return null; // Skip if referralData is undefined

      const createdAt = userCreatedAtMap.get(firstLevelReferral.referredId) || new Date();

      // Fetch userDetails asynchronously
      const userDetails = await Users.findOne({
        where: { id: referralDataSecondLevel.userId }
      }) as IUserDetails | null;

      return new SecondLevelReferralTrackClass({
        userId: referralDataSecondLevel.userId,
        firstLevel: false,
        secondLevel: true,
        referredId: firstLevelReferral.referredId,
        referralCode: referralDataSecondLevel.referralCode,
        isProcessed: false,
        isEmployee: userDetails ? userDetails.email.includes("@mittarv.com") : false,
        createdAt: createdAt
      });
    })
  ))
    .filter((track): track is SecondLevelReferralTrackClass => track !== null); // Type-safe filter

  await Promise.all(
    secondLevelReferralTracks.map(async (referralDetail) => {
      await ReferralTrack.create(referralDetail);
    })
  );

  try {
    const referralSummaryRaw = await ReferralTrack.findAll({
      attributes: [
        'userId',
        [
          Sequelize.literal(
            'CAST(SUM(CASE WHEN firstLevel = true THEN 1 ELSE 0 END) AS SIGNED)'
          ),
          'firstLevelCount'
        ],
        [
          Sequelize.literal(
            'CAST(SUM(CASE WHEN secondLevel = true THEN 1 ELSE 0 END) AS SIGNED)'
          ),
          'secondLevelCount'
        ],
        [Sequelize.literal('MAX(isEmployee)'), 'isEmployee'],
        [Sequelize.literal('MAX(isProcessed)'), 'isProcessed'],
        [Sequelize.literal('MAX(referralCode)'), 'referralCode'],
        [Sequelize.literal("DATE(createdAt)"), 'createdDate'],
        [Sequelize.literal("MIN(createdAt)"), 'originalCreatedAt']
      ],
      where: {
        isProcessed: false
      },
      group: ['userId', Sequelize.literal("DATE(createdAt)")],
      order: [Sequelize.literal("DATE(createdAt) DESC"), ['userId', 'ASC']]
    }) as IDailyReferralCounts[];


    const referralSummary = referralSummaryRaw.map(referralDetail =>
      new DailyReferralCountsClass({
        ...referralDetail['dataValues'],
        createdAt: referralDetail['dataValues'].originalCreatedAt
      })
    )

    await Promise.all(
      referralSummary.map(async (referralDetail) => {
        await DailyReferralCount.create(referralDetail);
      })
    )

    await ReferralTrack.update(
      { isProcessed: true },
      { where: { isProcessed: false } }
    );

    //*********************************************************Partner Referral*****************************************************************//

    const allPartnerReferralCodes = await Partners.findAll({
      attributes: ["id", "standardReferralCode"],
      raw: true
    }) as IParnerReferralCodes[];

    const allMultiReferralCodes = await partnerReferralCode.findAll({
      attributes: ["partnerId", "referralCode"],
      raw: true
    }) as IPMultiReferralCodes[];

    const mergedReferralCodes = allPartnerReferralCodes.map(partner => {
        const multiCodes = allMultiReferralCodes
          .filter(multi => multi.partnerId === partner.id)
          .map(multi => multi.referralCode);

        return {
          ...partner,
          allReferralCodes: [partner.standardReferralCode, ...multiCodes]
        };
    });

    const allPartnerReferralCodesArray = mergedReferralCodes.flatMap(partner => partner.allReferralCodes);

    const pastValidReferrals = await PartnerReferralTrackModel.findAll({
      attributes: ['referredId']
    });

    const pastValidPartnerReferralIds = [...new Set(pastValidReferrals.map(referral => referral.referredId))];

    const allPartnerReferralsUsers = await Users.findAll({
      where: {
        id: { [Op.notIn]: pastValidPartnerReferralIds }, // Ensures userId is NOT in pastValidReferralIds to avoid duplication 
        referredBy: allPartnerReferralCodesArray,
      }
    });

    const partnerReferralToBeCreated = await Promise.all(
      allPartnerReferralsUsers.map(async (user) => {    
        const partnerDetails = mergedReferralCodes.find(
          (partnerDetails) => partnerDetails.allReferralCodes.includes(user.referredBy)
        );
    
        const userDetails = await Users.findOne({
          where: { id: user.id }
        }) as IUserDetails | null;
    
        if (!partnerDetails || !userDetails) return null;
    
        return new partnerReferralTrackClass({
          partnerId: partnerDetails.id,
          firstLevel: 1,
          referredId: user.id,
          referralCode: user.referredBy,
          isProcessed: false,
          createdAt: userDetails?.createdAt
        });
      })
    );
    
    // Remove null values before creating records
    const validReferrals = partnerReferralToBeCreated.filter(referral => referral !== null);
    
    await Promise.all(
      validReferrals.map(async (referralDetail) => {
        console.log(referralDetail);
        await PartnerReferralTrackModel.create(referralDetail);
      })
    );
    

    console.log("Execution of the Referral Pipeline ended at :", new Date())
  } catch (error) {
    console.log("Error executing the Referral Pipeline :", error);
  }
}


