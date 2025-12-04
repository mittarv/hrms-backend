import { KeyValueActionEnum } from "../enums/enums";

export enum partnerFieldInputType {
  text = "text",
  date = "date",
  largeText = "large_text",
  email = "email",
  phoneNumber = "phone_number",
  upload = "upload",
  checkbox = "checkbox",
  dropdown = "dropdown",
}

export enum partnerOnboardingSections {
  basicInformation = "Basic Information",
  contactInformation = "Contact Information",
  legalAndCompliance = "Legal and Compliance",
  productRequirement = "Product Requirement",
  financialInformation = "Financial Information",
  operationalDetails = "Operational Details",
  commissionDetails = "Commission Details",
  additionalNotes = "Additional Notes",
}

export enum partnerContactTypes {
  primary = "Primary",
  escalation = "Escalation",
  executive = "Executive Sponsor",
  partnerBilling = "Partner Billing",
}

interface PartnerDetails {
  partnerName: string;
  standardReferralCode: string;
  partnerCode: string;
  status: number;
}

export interface PartnerContact {
  type: partnerContactTypes;
  name: string;
  email: string;
  phoneNumber: number;
  designation?: string;
}

export interface Field {
  id: number;
  fieldName: string;
  type: partnerFieldInputType;
  mandatory: boolean;
  section: partnerOnboardingSections;
}

export interface DynamicFields {
  fieldId: number;
  value: string;
}

export interface createPartnerInputInterface {
  partnerDetails: PartnerDetails;
  partnerContacts: PartnerContact[];
  dynamicFields: DynamicFields[];
}

// ===============================interfaces for the new modele================================

export interface partnerFieldInput {
  partnerName: string;
  partnerLogo: string;
  entityType: string;
  dateOfIncorporation: Date;
  taxIdentificationNumber: string;
  standardReferralCode: string;
  defaultPartnerFeatureConfig: string;
  partnerCode: string;
  status: number;
  isAffiliate: boolean;
}

export interface partnerReferralCode {
  referralCode: string;
  isValid: boolean;
  startDate: Date;
  endDate: Date;
}

export interface partnerOperationDetails {
  partnershipType: string;
  slaUpload: string;
  responsibilities: string;
  partnershipGoal: string;
  customClauses: string;
}

export interface partnerLegalAndCompliance {
  ndaUpload: string;
  ndaUploadRemarks: string;
  agreementUpload: string;
  agreementUploadRemarks: string;
  incorporationUpload: string;
  incorporationUploadRemarks: string;
  taxComplianceUpload: string;
  taxComplianceUploadRemarks: string;
  corporateIdentityNumber: string;
  documentExpiryDate: Date;
  isLifeTimeValid: boolean;
}

export interface partnerFinalcialInformation {
  bankAccNumber: string;
  accountName: string;
  bankName: string;
  branchCode: string;
  swiftCode: string;
  partnerBillingContactName: string;
  partnerBillingContactEmail: string;
  partnerBillingContactNumber: string;
  partnerBillingContactCode: string;
}

// export interface partnerFieldChangesLog {
//   approvalId: string;
//   partnerId: string;
//   tableId: string;
//   data: string;
// }

export interface partnerApprovalInterface {
  approvalStatus: string;
  approvedBy: number;
  approvedAt: Date;
  requestedAt: Date;
  requestedBy: number;
  jiraNumber: string;
}

export interface partnerAuditInterface {
  requestedBy: number;
  requestedOn: Date;
  approvedBy: number;
  jiraNumber: string;
  approvedAt: Date;
  status: string;
}

export interface Contact {
  type: string; // POC, Escalation, or Executive
  partnerContactName: string;
  email: string;
  phoneNumber: string;
  designation: string;
  partnerCountryCode: string;
}
export interface partnerContactInformation {
  registeredOffice: string;
  operationalAddress: string;
  dateOfIncorporation: Date;

  contacts: Contact[]; // Array of contacts based on type
}
export interface partnerCommissionDetails {
  commissionPercentageMonthly: number;
  commissionPercentageYearly: number;
  preferredCurrency: string;
  effectiveFrom:Date;
  effectiveTo:Date;
}

export interface partnerOnboardingInterface {
  partnerFieldInput: partnerFieldInput;
  // no need to store multiple referral codes for now
  partnerReferralCodes: partnerReferralCode[];
  partnerOperationDetails: partnerOperationDetails;
  partnerLegalAndCompliance: partnerLegalAndCompliance;
  partnerFinalcialInformation: partnerFinalcialInformation;
  // this would be an array
  partnerContactInformation: partnerContactInformation;
  partnerCommissionDetails: partnerCommissionDetails;
  partnerAuditInterface: partnerAuditInterface;
  partnerApproval: partnerApprovalInterface;
  requestedBy: number;
  approvedBy: number;
  jiraNumber: string;

  // adding these fields only for update purposes, these field woun't be required while data creation
  partnerId: string;
}

export interface approvePartnerInterface {
  partnerId: string;
  approvalStatus: string;
  approvedBy: number;
  jiraNumber: string;
}

// https://mittarvtesting.blob.core.windows.net/partner-tool/1739274856898_kjbsjjckasd.jpg
// 
// ?sv=2025-01-05&st=2025-02-11T11%3A54%3A17Z&se=2025-02-11T15%3A54%3A17Z&sr=b&sp=r&sig=RBr1qgTvV6pJ4DQlfxzZSr7wEUGb%2FuduLn3LZC42SzQ%3D


// Interface for PolicyList model
export interface PolicyListAttributes {
  id: number;
  policyName: string;
  policyLink: string;
  version: string;
  remarks?: string | null;
  approvedBy?: string | null;
  lastModifiedBy?: number | null;
  createdBy?: number | null;
  isDeleted?: boolean | null;
  createdAt?: Date;
  updatedAt?: Date;
}

// Interface for ImportantLinkList model
export interface ImportantLinkListAttributes {
  id: number;
  toolName: string;
  toolLink: string;
  lastModifiedBy?: number | null;
  createdBy?: number | null;
  isDeleted?: boolean | null;
  createdAt?: Date;
  updatedAt?: Date;
}

// Interface for KeyValuePairApproval model
export interface KeyValuePairApprovalAttributes {
  id: number;
  category: string;
  key?: string | null;
  value: string;
  description: string;
  actionStatus?: boolean | null;
  requestedBy?: string | null;
  requestedAt?: Date | null;
  requestedId?: number | null;
  actionToPerform: KeyValueActionEnum;
  approvedBy?: string | null;
  approvedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

// Interface for KnownIssuesActivityLog model
export interface KnownIssuesActivityLogAttributes {
  id: number;
  issueId: number;
  requestedFor: number;   // 0 = new, 1 = update, 2 = delete
  requestedBy: number;
  requestedOn?: Date | null;
  actionTaken: number;    // 0 = pending, 10 = accepted, 20 = rejected
  actionTakenBy: number;
  actionTakenOn?: Date | null;
  jiraNo?: string | null;
  isDeleted?: boolean | null;

  createdAt?: Date;
  updatedAt?: Date;
}

// Interface for KnownIssuesApproval model
export interface KnownIssuesApprovalAttributes {
  id: number;
  issueId: number;
  requestedFor: number;   // 0 = New, 1 = Update, 2 = Delete
  requestedOn?: Date | null;
  actionStatus?: number;   // 0 = pending, 10 = accepted, 20 = rejected
  comment?: string | null;
  isDeleted?: boolean | null;

  createdAt?: Date;
  updatedAt?: Date;
}





