import { approvalStatusCapsEnum } from "../enums/enums";
import { ProcessorType } from "../../../interfaces/paymentsInterfaces/enums";

// Define the interface for partner approval
export interface PartnerApprovalAttributes {
  id?: string;
  approvalStatus?: approvalStatusCapsEnum | null;
  approvedBy?: number | null;
  partnerId?: string | null;
  tableId?: string | null;
  approvedAt?: Date | null;
  requestedAt?: Date | null;
  requestedBy?: number | null;
  jiraNumber?: string | null;
  isDeleted?: boolean | null;

  createdAt?: Date;
  updatedAt?: Date;
}

// Define the interface for partner audit
export interface PartnerAuditAttributes {
  id?: string;
  requestedBY?: number | null;
  requestedOn?: Date | null;
  approvedBy?: number | null;
  jiraNumber?: string | null;
  approvedAt?: Date | null;
  status?: approvalStatusCapsEnum.APPROVED | approvalStatusCapsEnum.REJECTED | null;
  isDeleted?: boolean | null;

  createdAt?: Date;
  updatedAt?: Date;
}

// Define the interface for partner commission details
export interface PartnerCommissionDetailsAttributes {
  id?: string;
  partnerId?: string | null;
  commissionPercentageMonthly?: number | null;
  commissionPercentageYearly?: number | null;
  preferredCurrency?: string | null;
  effectiveFrom?: Date;
  effectiveTo?: Date | null;
  isDeleted?: boolean | null;
  createdAt?: Date;
  updatedAt?: Date;
}

// Define the interface for partner contact info
export interface PartnerContactInfoAttributes {
  id?: string;
  partnerId?: string | null;
  type?: string | null;
  registeredOffice?: string | null;
  operationalAddress?: string | null;
  partnerCountryCode?: string | null;
  partnerContactName?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  designation?: string | null;
  isDeleted?: boolean | null;
  createdAt?: Date;
  updatedAt?: Date;
}

// Define the interface for partner field changes
export interface PartnerFieldChangesLogAttributes {
  id?: string;
  approvalId?: string | null;
  partnerId?: string | null;
  tableId?: string | null;
  data?: any | null;       // JSON log structure
  isDeleted?: boolean | null;
  createdAt?: Date;
  updatedAt?: Date;
}

// Define the interface for partner financial info
export interface PartnerFinancialInfoAttributes {
  id?: string;
  partnerId?: string | null;
  bankAccNumber?: string | null;
  accountName?: string | null;
  bankName?: string | null;
  branchCode?: string | null;
  swiftCode?: string | null;
  partnerBillingContactName?: string | null;
  partnerBillingContactEmail?: string | null;
  partnerBillingContactNumber?: string | null;
  partnerBillingContactCode?: string | null;
  isDeleted?: boolean | null;

  createdAt?: Date;
  updatedAt?: Date;
}

// Define the interface for partner legal compliance
export interface PartnerLegalComplianceAttributes {
  id?: string;
  partnerId?: string | null;
  ndaUpload?: string | null;
  ndaUploadRemarks?: string | null;
  agreementUpload?: string | null;
  agreementUploadRemarks?: string | null;
  incorporationUpload?: string | null;
  incorporationUploadRemarks?: string | null;
  taxComplianceUpload?: string | null;
  taxComplianceUploadRemarks?: string | null;
  corporateIdentityNumber?: string | null;
  documentExpiryDate?: Date | null;
  isLifeTimeValid?: boolean | null;
  isDeleted?: boolean | null;

  createdAt?: Date;
  updatedAt?: Date;
}

// Define the interface for partner
export interface PartnerAttributes {
  id?: string;
  partnerName?: string | null;
  partnerLogo?: string | null;
  entityType?: string | null;
  isAffiliate?: boolean | null;
  dateOfIncorporation?: Date | null;
  taxIdentificationNumber?: string | null;
  standardReferralCode?: string | null;
  defaultPartnerFeatureConfig?: boolean | null;
  partnerCode?: string | null;
  status?: number | null;
  isDeleted?: boolean | null;

  createdAt?: Date;
  updatedAt?: Date;
}

// Define the interface for partner operation
export interface PartnerOperationDetailsAttributes {
    id?: string;
    partnerId?: string | null;
    partnershipType?: string | null;
    slaUpload?: string | null;
    responsibilities?: string | null;
    partnershipGoal?: string | null;
    customClauses?: string | null;
    isDeleted?: boolean | null;

    createdAt?: Date;
    updatedAt?: Date;
}

// Define the interface for partner referral code
export interface PartnerReferralCodeAttributes {
    id?: string;
    partnerId?: string | null;
    referralCode?: string | null;
    isValid?: boolean | null;
    startDate?: Date | null;
    endDate?: Date | null;
    isDeleted?: boolean | null;

    createdAt?: Date;
    updatedAt?: Date;
}

// Define the interface for product revenue
export interface ProductRevenueAttributes {
    id?: string;
    productId: string;
    paymentProcessor: ProcessorType;
    countryIsoCode: string;
    currencyCode: string;
    revenue: number | string; // Decimal values are often returned as string from Sequelize

    createdAt?: Date;
    updatedAt?: Date;
}








