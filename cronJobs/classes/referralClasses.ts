import { IUserReferralDetails, IReferralTrack, IUserDetails, IDailyReferralCounts, IParnerReferralTrack } from "../Interfaces/referralInterfaces";

class UserDetailsClass implements IUserDetails {
    id: number;
    name: string;
    email: string;
    image: string;
    status: string;
    countryCode: string;
    phone: number;
    country: string;
    referredBy: string;
    isDeleted: boolean;
    createdAt: Date;
    updatedAt: Date;

    private static userDetailsMap: Map<number, UserDetailsClass> = new Map();

    constructor(user: IUserDetails) {
        this.id = user.id;
        this.name = user.name;
        this.email = user.email;
        this.image = user.image;
        this.status = user.status;
        this.countryCode = user.countryCode;
        this.phone = user.phone;
        this.country = user.country;
        this.referredBy = user.referredBy;
        this.isDeleted = user.isDeleted;
        this.createdAt = new Date(user.createdAt);
        this.updatedAt = new Date(user.updatedAt);

        UserDetailsClass.userDetailsMap.set(this.id, this);
    }

    static getUserById(userId: number): UserDetailsClass | undefined {
        return UserDetailsClass.userDetailsMap.get(userId);
    }
}

class FirstLevelReferralTrackClass implements IReferralTrack {
    userId: number;
    firstLevel: boolean;
    secondLevel: boolean;
    isEmployee: boolean;
    referredId: number;
    referralCode: string;
    isProcessed: boolean;
    createdAt: Date;

    constructor(referral: IReferralTrack) {
        this.userId = referral.userId;
        this.firstLevel = true;
        this.secondLevel = false;
        this.referredId = referral.referredId;
        this.referralCode = referral.referralCode;
        this.isProcessed = referral.isProcessed;
        this.createdAt = referral.createdAt;
        this.isEmployee =  referral.isEmployee;

       }
}

class SecondLevelReferralTrackClass implements IReferralTrack {
    userId: number;
    firstLevel: boolean;
    secondLevel: boolean;
    isEmployee: boolean;
    referredId: number;
    referralCode: string;
    isProcessed: boolean;
    createdAt: Date;

    constructor(referral: IReferralTrack) {
        this.userId = referral.userId;
        this.firstLevel = false;
        this.secondLevel = true;
        this.referredId = referral.referredId;
        this.referralCode = referral.referralCode;
        this.isProcessed = referral.isProcessed;
        this.createdAt = referral.createdAt;
        this.isEmployee =  referral.isEmployee;
    }
}
class DailyReferralCountsClass implements IDailyReferralCounts {
    userId: number;
    firstLevelCount: number;
    secondLevelCount: number;
    isEmployee: boolean;
    referralCode: string;
    isProcessed: boolean;
    createdAt: Date;

    constructor(referral: IDailyReferralCounts) {
        this.userId = referral.userId;
        this.firstLevelCount = referral.firstLevelCount;
        this.secondLevelCount = referral.secondLevelCount;
        this.referralCode = referral.referralCode;
        this.isProcessed = referral.isProcessed;
        this.createdAt = referral.createdAt;
        this.isEmployee = referral.isEmployee;
    }
}

class UserReferralDetailsClass implements IUserReferralDetails {
    id: number;
    userId: number;
    schemeId: number;
    referralCode: string;
    beginDate: Date;
    endDate: Date | null;
    isDeleted: boolean;
    createdAt: Date;
    updatedAt: Date;

    constructor(referral: IUserReferralDetails) {
        this.id = referral.id;
        this.userId = referral.userId;
        this.schemeId = referral.schemeId;
        this.referralCode = referral.referralCode;
        this.beginDate = new Date(referral.beginDate);
        this.endDate = referral.endDate ? new Date(referral.endDate) : null;
        this.isDeleted = referral.isDeleted;
        this.createdAt = new Date(referral.createdAt);
        this.updatedAt = new Date(referral.updatedAt);
    }
}


class newValidUsersClass {
    userId: number;
    constructor(userId: number) {
        this.userId = userId;
    }
}

class partnerReferralTrackClass {
    partnerId: string;
    firstLevel: number;
    referredId: number;
    referralCode: string;
    isProcessed: boolean;
    createdAt: Date;

    constructor(referral: IParnerReferralTrack) {
        this.partnerId = referral.partnerId;
        this.firstLevel = referral.firstLevel;
        this.referredId = referral.referredId;
        this.referralCode = referral.referralCode;
        this.isProcessed = referral.isProcessed;
        this.createdAt = referral.createdAt;

    }
}
//PARNTER REFERRAL RELATED


export {
    FirstLevelReferralTrackClass,
    SecondLevelReferralTrackClass,
    UserDetailsClass,
    UserReferralDetailsClass,
    newValidUsersClass,
    DailyReferralCountsClass,

    //PARNTER REFERRAL RELATED
    partnerReferralTrackClass
}