// interface for login api
export interface socialLoginRequestInterface {
  idToken: string;
  isGoogleLogin: boolean;
  isAppleLogin: boolean;
  isLinkedInLogin: boolean;
  tokens: string;
}

// Path: backend/interfaces/platformInterfaces/userControllerInterface.ts
// interface for get google login token api
export interface getGoogleLoginTokenInterFace {
  code: string;
}

// Path: backend/interfaces/platformInterfaces/userControllerInterface.ts
// interface for login api only for email
export interface emailInterface {
  email: string;
}

// Path: backend/interfaces/platformInterfaces/userControllerInterface.ts
// interfaces for otp email 
export interface otpEmailInterface {
  email: string;
  otp: string;
}

// interfaces for create profile api
export interface createProfileInterface {
  email: string;
  name: string;
  status: string;
  phone: string;
  country: string;
  countryCode: string;
  image: string;
  referredBy: string;
  isWeb: boolean;
  countryIsoCode: string;
}

// interfaces for create profile v2 api
export interface createProfileInterfaceV2 {
  email: string;
  name: string;
  status: string;
  phone: string;
  countryCode: string;
  countryIdPrimary: number;
  countryIdResidence: number;
  image: string;
  referredBy: string;
  isWeb: boolean;
  countryIsoCode: string;
}


// Path: backend/interfaces/platformInterfaces/userControllerInterface.ts
// interface for referral interface
export interface referralInterface {
  email: string;
  referralCode: string;
}

// Path: backend/interfaces/platformInterfaces/userControllerInterface.ts
// interface for add alternate email api interface
export interface addAlternateEmailInterface {
  altEmailId: string;
  otp: string;
}

// Path: backend/interfaces/platformInterfaces/userControllerInterface.ts
// interface for alternate email verification
export interface alternateEmailInterface {
  altEmailId: string;
}
// Path: backend/interfaces/platformInterfaces/userControllerInterface.ts
// interface for mark activity viewd by user id api interface
export interface markActivityAsViewedByUserIdInterface {
  attribute: string;
  platformType: string;
}


// phone number verification interface starts from here 
export interface phoneNumberInterface{
  phone: number;
  countryCode: string;
}


export interface verifyPhoneNumberInterface{
  phone: number;
  otp: number;
  countryCode: string;
  id:number; 
}

export interface TokenPayload {
  id: number;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface DeviceInfo {
  userAgent?: string;
  deviceToken: string;
  deviceName?: string;
}

export interface UserCountries {
  id: number;
  userId: number;
  countryId: number;
  countryTypeId: number;
  isDeleted: boolean;
}

export interface AssetRetention {
  id: number;
  assetId: number;
  userId: number;
  isDeleted: boolean;
  deletionScheduledAt: Date;
}

// Interface for alternate emails
export interface IUserAlternateEmails {
  id: number;
  userId: number;
  email: string;
  isDeleted?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// Interface for Appleuser
export interface IAppleUser {
  id: number;
  appleAuthId: string;
  userId: number;
  email?: string;
  isDeleted?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// Interface for user activity tracking
export interface IUserActivityTracking {
  id: number;
  userId: number;
  platformType?: string;
  attribute: string;
  isViewed?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// Interface for user identifier
export interface IUserIdentifier {
  id: number;
  userId: number;
  userIdentifierId: string;
  companyCode?: string;
  userIsoCode?: string;
  userIdentifierNumber?: string;
  idType?: string;
  isDeleted?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// Interface for user details
export interface UserAttributes {
  id: number;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  status?: string | null;
  countryCode?: string;
  phone?: number | null;
  country?: string | null;
  referredBy?: string | null;
  isDeleted?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// Interface for user phone number
export interface UserPhoneNumberAttributes {
  id: number;
  userId: number;
  phone: number;
  countryCode: string;
  isVerified?: boolean;
  popupReminder?: Date | null;
  isDeleted?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// Interface for user token
export interface UserTokenAttributes {
  id: number;
  userId: number;
  token: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// Interface for user waiting list
export interface UserWaitingListAttributes {
  id: number;
  email?: string | null;
  joinedDateTime?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

// Interface for temp otp info
export interface TempOtpInfoAttributes {
  id: number;
  email?: string | null;
  otp?: number | null;
  otp_expiry?: Date | null;
  verified?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// Interface for registered users
export interface RegisteredUsersAttributes {
  id: number;
  email?: string | null;
  referralCode?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

// Interface for temp apple user
export interface TempAppleUserAttributes {
    email: string;          // Primary key, unique email
    appleAuthId: string;    // Apple auth ID

    createdAt?: Date;       // Optional, automatically set by Sequelize
    updatedAt?: Date;       // Optional, automatically set by Sequelize
}

// Interface for temp phone otp
export interface TempPhoneOtpAttributes {
    id: number;
    userId: number;
    otp: number;
    phone: number;
    isDeleted?: boolean;
    otpExpiry: Date;

    createdAt?: Date;
    updatedAt?: Date;
}

// Interface for user tasks
export interface UserTasksAttributes {
    id: number;
    userId: number;
    taskName: string;
    isCompleted?: number;
    isDeleted?: boolean;

    createdAt?: Date;
    updatedAt?: Date;
}

//Interface for allCountryDetails
export interface AllCountryDetailsAttributes {
  id: number;
  countryIsoCode: string;
  countryIsoCodeAlpha3: string;
  countryName: string;
  countryPhoneCode: string;
  countryFlagSvg: Buffer;
  currencyName: string;
  currencySymbol: string;
  currencyCodeAlpha2: string;
  currencyCodeAlpha3: string;
  transactionCurrencySymbol?: string;
  transactionCurrencyCodeAlpha3?: string;
  ppp?: number;
  createdAt?: Date;
  updatedAt?: Date;
}
