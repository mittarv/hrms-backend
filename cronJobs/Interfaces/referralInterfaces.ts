// Stores the complete user details
export interface IUserDetails {
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
}

// Schema of the Referral track
export interface IReferralTrack {
    userId: number;
    firstLevel: boolean;
    secondLevel: boolean;
    isEmployee: boolean;
    referredId: number;
    referralCode: string;
    isProcessed: boolean;
    createdAt: Date;
}


export interface IUserReferralDetails {
    id: number;
    userId: number;
    schemeId: number;
    referralCode: string;
    beginDate: Date;
    endDate: Date | null; 
    isDeleted: boolean;
    createdAt: Date;
    updatedAt: Date;
}

// Interface for the DailyReferralCount

export interface IDailyReferralCounts {
    userId: number;
    firstLevelCount: number;
    secondLevelCount: number;
    isEmployee: boolean;
    referralCode: string;
    isProcessed: boolean;
    createdAt: Date;
}


// Wills that belong to the user with its createdAt date which we use to determine the time of successfull referral
export interface INewWills {
    id: number;
    userId: number;
    createdAt: Date;
}

// Assets that belong to the user with its createdAt date which we use to determine the time of successfull referral
export interface INewAssets {
    id: number;
    userId: number;
    createdAt: Date;
}

// We get all the userIds and referralId from the referral track so if a id existed in the referral section means that that was a valid referral and we dont need to create again
export interface IPastValidUsers {
    userId: number;
    referredId: number;
}

export interface IParnerReferralCodes {
    id: string;
    standardReferralCode : string
}
export interface IPMultiReferralCodes {
    partnerId: string;
    referralCode : string
}

export interface IParnerReferralTrack {
    partnerId: string;
    firstLevel: number;
    referredId: number;
    referralCode: string;
    isProcessed: boolean;
    createdAt: Date;
}

