// Interface for UserCountries
export interface UserCountriesAttributes {
    id?: number;
    userId: number;
    countryId: number;
    countryTypeId: number;
    isDeleted?: boolean;
}

// Interface for UserLanguageSuggestion
export interface UserLanguageSuggestionAttributes {
    id?: number;
    userId: number;
    languageName: string;
    createdAt?: Date;
    updatedAt?: Date;
}

// Interface for UserSelectedLanguage
export interface UserSelectedLanguageAttributes {
    id?: number;
    userId: number;
    languageId: number;
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
