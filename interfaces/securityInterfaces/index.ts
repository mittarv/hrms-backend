export interface UserIdentifierData {
  userIdentifierId?: string | null;
  companyCode?: string | null;
  userIsoCode?: string | null;
  userIdentifierNumber?: string | number | null;
}

export interface EncryptionOptions {
  targetLength: number;
  shouldReturnNumbers?: boolean;
}

export interface FieldLengths {
  userIdentifierId: number;
  companyCode: number;
  userIsoCode: number;
  userIdentifierNumber: number;
}
