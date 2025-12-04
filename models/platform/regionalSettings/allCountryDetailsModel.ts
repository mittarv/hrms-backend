import { DataTypes, Model, Sequelize } from "sequelize";
import { AllCountryDetailsAttributes } from "../../../interfaces/platformInterfaces/interfaces/regionalSettingsInterface";


export class AllCountryDetails
    extends Model<AllCountryDetailsAttributes, Partial<AllCountryDetailsAttributes>>
    implements AllCountryDetailsAttributes {
    declare id: number;
    declare countryIsoCode: string;
    declare countryIsoCodeAlpha3: string;
    declare countryName: string;
    declare countryPhoneCode: string;
    declare countryFlagSvg: Buffer;
    declare currencyName: string;
    declare currencySymbol: string;
    declare currencyCodeAlpha2: string;
    declare currencyCodeAlpha3: string;
    declare transactionCurrencySymbol?: string;
    declare transactionCurrencyCodeAlpha3?: string;
    declare ppp?: number;


    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;
}

module.exports = (sequelize: Sequelize, datatypes: typeof DataTypes) => {
    AllCountryDetails.init(
        {
            id: {
                type: datatypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
                allowNull: false,
            },
            countryIsoCode: {
                type: datatypes.STRING,
                allowNull: false,
            },
            countryIsoCodeAlpha3: {
                type: datatypes.STRING,
                allowNull: false,
            },
            countryName: {
                type: datatypes.STRING,
                allowNull: false,
            },
            countryPhoneCode: {
                type: datatypes.STRING,
                allowNull: false,
            },
            countryFlagSvg: {
                type: datatypes.BLOB("long"),
                allowNull: false,
            },
            currencyName: {
                type: datatypes.STRING,
                allowNull: false,
            },
            currencySymbol: {
                type: datatypes.STRING,
                allowNull: false,
            },
            currencyCodeAlpha2: {
                type: datatypes.STRING,
                allowNull: false,
            },
            currencyCodeAlpha3: {
                type: datatypes.STRING,
                allowNull: false,
            },
            transactionCurrencySymbol: {
                type: datatypes.STRING,
                allowNull: true,
            },
            transactionCurrencyCodeAlpha3: {
                type: datatypes.STRING,
                allowNull: true,
            },
            ppp: {
                type: datatypes.DOUBLE,
                allowNull: true,
            },
        },
        {
            sequelize,
            modelName: "allCountryDetails",
            timestamps: true,
            updatedAt: "updatedAt",
            createdAt: "createdAt",
        }
    );

    return AllCountryDetails;
};
