import crypto from 'crypto';
import { 
  UserIdentifierData, 
  EncryptionOptions, 
  FieldLengths, 
  UserIdentifierEncryptionInterface 
} from '../interfaces/securityInterfaces/index';

/**
 * UserIdentifier Field Encryption Utility (Format-Preserving, Reversible)
 *
 * This uses keyed per-position masks to transform characters while preserving:
 * - Exact length
 * - Character class (digits stay digits; uppercase letters stay uppercase letters)
 *
 * It is deterministic and reversible with the same key, enabling lookups.
 */

const ENCRYPTION_KEY = process.env.USER_IDENTIFIER_ENCRYPTION_KEY;
if (!ENCRYPTION_KEY) {
    throw new Error('USER_IDENTIFIER_ENCRYPTION_KEY environment variable is required');
}

// Precompute masks for digits and uppercase letters
const DIGIT_MASK_LEN = 32;
const ALPHA_MASK_LEN = 32;

const buildMaskArray = (prefix: string, modulo: number, length: number): number[] => {
    const masks = new Array(length);
    for (let i = 0; i < length; i++) {
        const hmac = crypto.createHmac('sha256', ENCRYPTION_KEY);
        hmac.update(prefix + ':' + i.toString());
        const digest = hmac.digest();
        // Fold bytes to one number then mod
        let acc = 0;
        for (let b = 0; b < digest.length; b++) {
            acc = (acc + digest[b]) % 0x7fffffff;
        }
        masks[i] = acc % modulo;
    }
    return masks;
};

const DIGIT_MASKS = buildMaskArray('NUMERIC', 10, DIGIT_MASK_LEN);
const ALPHA_MASKS = buildMaskArray('ALPHA', 26, ALPHA_MASK_LEN);

const isDigit = (c: string): boolean => c >= '0' && c <= '9';
const isUpper = (c: string): boolean => c >= 'A' && c <= 'Z';

// Transform preserving format; when decrypt=false it encrypts; when decrypt=true it decrypts
const transformPreservingFormat = (input: string | number | null, decrypt = false): string | null => {
    if (input == null) return input;
    const str = String(input);
    let out = '';
    for (let i = 0; i < str.length; i++) {
        const ch = str[i];
        if (isDigit(ch)) {
            const mask = DIGIT_MASKS[i % DIGIT_MASK_LEN];
            const val = ch.charCodeAt(0) - 48; // 0..9
            const res = decrypt ? (val - mask + 10) % 10 : (val + mask) % 10;
            out += String.fromCharCode(48 + res);
        } else if (isUpper(ch)) {
            const mask = ALPHA_MASKS[i % ALPHA_MASK_LEN];
            const val = ch.charCodeAt(0) - 65; // 0..25
            const res = decrypt ? (val - mask + 26) % 26 : (val + mask) % 26;
            out += String.fromCharCode(65 + res);
        } else {
            // For safety, leave other chars unchanged (not expected in our fields)
            out += ch;
        }
    }
    return out;
};

// Wrapper to enforce exact target length (truncate/pad should never be needed as we preserve length)
const encryptToFixedLength = (plaintext: string | number | null, targetLength: number, shouldReturnNumbers = false): string | null => {
    if (!plaintext) return null;
    const enc = transformPreservingFormat(String(plaintext), false);
    if (enc === null) return null;
    
    // Ensure digits-only for numeric field
    if (shouldReturnNumbers) {
        // transform already keeps digits as digits; ensure length
        if (enc.length !== targetLength) {
            return enc.slice(0, targetLength).padEnd(targetLength, '0');
        }
        return enc;
    }
    // Non-numeric fields: preserve format and length
    if (enc.length !== targetLength) {
        return enc.slice(0, targetLength).padEnd(targetLength, 'A');
    }
    return enc;
};

const decryptFromFixedLength = (encryptedText: string | number | null, originalLength?: number, isNumericField = false): string | null => {
    if (!encryptedText) return null;
    const dec = transformPreservingFormat(String(encryptedText), true);
    if (dec === null) return null;
    
    // Length should match; if not, normalize
    if (originalLength && dec.length !== originalLength) {
        return dec.slice(0, originalLength);
    }
    return dec;
};

/**
 * Encrypts UserIdentifier fields according to their schema constraints
 */
const encryptUserIdentifierFields = (data: UserIdentifierData): UserIdentifierData => {
    if (!data) return data;
    
    const encrypted = { ...data };
    
    if (data.userIdentifierId) {
        encrypted.userIdentifierId = encryptToFixedLength(data.userIdentifierId, 14);
    }
    
    if (data.companyCode) {
        encrypted.companyCode = encryptToFixedLength(data.companyCode, 2);
    }
    
    if (data.userIsoCode) {
        encrypted.userIsoCode = encryptToFixedLength(data.userIsoCode, 2);
    }
    
    if (data.userIdentifierNumber) {
        encrypted.userIdentifierNumber = encryptToFixedLength(data.userIdentifierNumber.toString(), 10, true);
    }
    
    return encrypted;
};

/**
 * Decrypts UserIdentifier fields (returns encrypted values as-is for security)
 */
const decryptUserIdentifierFields = (data: UserIdentifierData): UserIdentifierData => {
    if (!data) return data;
    
    const decrypted = { ...data };
    
    if (data.userIdentifierId) {
        decrypted.userIdentifierId = decryptFromFixedLength(data.userIdentifierId, 14, false);
    }
    
    if (data.companyCode) {
        decrypted.companyCode = decryptFromFixedLength(data.companyCode, 2, false);
    }
    
    if (data.userIsoCode) {
        decrypted.userIsoCode = decryptFromFixedLength(data.userIsoCode, 2, false);
    }
    
    if (data.userIdentifierNumber) {
        decrypted.userIdentifierNumber = decryptFromFixedLength(data.userIdentifierNumber, 10, true);
    }
    
    return decrypted;
};

/**
 * Encrypts a single field for database lookup
 * This is the key function for maintaining lookup functionality
 */
const encryptFieldForLookup = (fieldName: keyof FieldLengths, value: string | number): string => {
    if (!value) return '';
    
    const fieldLengths: FieldLengths = {
        userIdentifierId: 14,
        companyCode: 2,
        userIsoCode: 2,
        userIdentifierNumber: 10
    };
    
    const targetLength = fieldLengths[fieldName];
    if (!targetLength) {
        throw new Error(`Unknown field name: ${fieldName}`);
    }
    
    const shouldReturnNumbers = fieldName === 'userIdentifierNumber';
    const result = encryptToFixedLength(value.toString(), targetLength, shouldReturnNumbers);
    return result || '';
};

const userIdentifierEncryption: UserIdentifierEncryptionInterface = {
    encryptUserIdentifierFields,
    decryptUserIdentifierFields,
    encryptFieldForLookup,
    encryptToFixedLength,
    decryptFromFixedLength
};

export default userIdentifierEncryption;
export {
    encryptUserIdentifierFields,
    decryptUserIdentifierFields,
    encryptFieldForLookup,
    encryptToFixedLength,
    decryptFromFixedLength
};
