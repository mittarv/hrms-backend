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

export interface UserIdentifierEncryptionInterface {
  encryptUserIdentifierFields(data: UserIdentifierData): UserIdentifierData;
  decryptUserIdentifierFields(data: UserIdentifierData): UserIdentifierData;
  encryptFieldForLookup(fieldName: keyof FieldLengths, value: string | number): string;
  encryptToFixedLength(plaintext: string | number | null, targetLength: number, shouldReturnNumbers?: boolean): string | null;
  decryptFromFixedLength(encryptedText: string | number | null, originalLength?: number, isNumericField?: boolean): string | null;
}
