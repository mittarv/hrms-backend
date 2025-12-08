import { Request, Response } from "express";
import { dbOutput } from "../../models";
import { Op } from "sequelize";

const { allCountryDetails: AllCountryDetails, } = dbOutput;

const validateField = (data: string, length: number) => {
    return data.length === length;
};

exports.getAllCountries = async (req: Request, res: Response) => {
  try {
    const countries = await AllCountryDetails.findAll({
        order: [["countryName", "ASC"]],
    });

    const updatedCountries = countries.map((country) => {
        const buffer = country["dataValues"]["countryFlagSvg"];
        const base64CountryFlagSvg = buffer.toString('base64');

        return {
            ...country["dataValues"],
            countryFlagSvg: base64CountryFlagSvg
        }
    });

    return res
        .status(200)
        .json({ 
            success: true, 
            countries: updatedCountries,
            message: "All countries fetched successfully"
        });

  } catch (error) {
    return res
      .status(400)
      .json({ success: false, message: (error as Error).message });
  }
};

exports.addNewCountry = async (req: Request, res: Response) => {
  try {
    
    const {
        countryIsoCode,
        countryIsoCodeAlpha3,
        countryName,
        countryPhoneCode,
        countryFlagSvg,
        currencyName,
        currencySymbol,
        currencyCodeAlpha2,
        currencyCodeAlpha3,
        transactionCurrencySymbol,
        transactionCurrencyCodeAlpha3,
        ppp
    } = req.body;

    if (
        !countryIsoCode ||
        !countryIsoCodeAlpha3 ||
        !countryName ||
        !countryPhoneCode ||
        !countryFlagSvg ||
        !currencyName ||
        !currencySymbol ||
        !currencyCodeAlpha2 ||
        !currencyCodeAlpha3
    ) {
        return res.status(400).json({
            success: false,
            message: "Missing some of required fields to add new country"
        });
    }

    // validate 2 and 3 digit country iso codes
    if (!validateField(countryIsoCode, 2)) {
        return res.status(400).json({
            success: false,
            message: "Invalid value of 'countryIsoCode' parameter provided"
        });
    }
    if (!validateField(countryIsoCodeAlpha3, 3)) {
        return res.status(400).json({
            success: false,
            message: "Invalid value of 'countryIsoCodeAlpha3' parameter provided"
        });
    }

    // validate 2 and 3 digit currency codes
    if (!validateField(currencyCodeAlpha2, 2)) {
        return res.status(400).json({
            success: false,
            message: "Invalid value of 'currencyCodeAlpha2' parameter provided"
        });
    }
    if (!validateField(currencyCodeAlpha3, 3)) {
        return res.status(400).json({
            success: false,
            message: "Invalid value of 'currencyCodeAlpha3' parameter provided"
        });
    }

    const countryAlreadyExists = await AllCountryDetails.findOne({
        where: {
            [Op.or]: [
                { countryName: countryName },
                { countryIsoCode: countryIsoCode }
            ]
        }
    });

    if (countryAlreadyExists) {
        return res.status(400).json({
            success: false,
            message: "Country with same name or ISO Code already exists"
        });
    }

    const newCountry = await AllCountryDetails.create({
        countryIsoCode,
        countryIsoCodeAlpha3,
        countryName,
        countryPhoneCode,
        countryFlagSvg: Buffer.from(countryFlagSvg, 'base64'),
        currencyName,
        currencySymbol,
        currencyCodeAlpha2,
        currencyCodeAlpha3,
        transactionCurrencySymbol: transactionCurrencySymbol ? transactionCurrencySymbol : currencySymbol,
        transactionCurrencyCodeAlpha3: transactionCurrencyCodeAlpha3 ? transactionCurrencyCodeAlpha3 : currencyCodeAlpha3,
        ppp
    });

    return res
        .status(200)
        .json({ 
            success: true, 
            country: newCountry,
            message: "Country added successfully"
        });

  } catch (error) {
    return res
      .status(400)
      .json({ success: false, message: (error as Error).message });
  }
};

exports.updateCountryByCountryIsoCode = async (req: Request, res: Response) => {
  try {
    const { countryIsoCode } = req.query;
    if (!countryIsoCode) {
        return res.status(400).json({ success: false, message: "Missing required 'countryIsoCode' query parameter" });
    }

    const existingCountry = await AllCountryDetails.findOne({
        where: { countryIsoCode: countryIsoCode }
    });

    if (!existingCountry) {
        return res.status(400).json({ success: false, message: "Country does not exist" });
    }

    const country = existingCountry["dataValues"];
    const updatedFields = {};

    for(const field in req.body) {
        if (field in country && field !== "countryIsoCode") {
            updatedFields[field] = req.body[field];
        }
    }

    if (updatedFields["countryIsoCodeAlpha3"] && !validateField(updatedFields["countryIsoCodeAlpha3"], 3)) {
        return res.status(400).json({ success: false, message: "Invalid value of 'countryIsoCodeAlpha3' parameter provided" });
    }
    if (updatedFields["currencyCodeAlpha2"] && !validateField(updatedFields["currencyCodeAlpha2"], 2)) {
        return res.status(400).json({ success: false, message: "Invalid value of 'currencyCodeAlpha2' parameter provided" });
    }
    if (updatedFields["currencyCodeAlpha3"] && !validateField(updatedFields["currencyCodeAlpha3"], 3)) {
        return res.status(400).json({ success: false, message: "Invalid value of 'currencyCodeAlpha3' parameter provided" });
    }

    await AllCountryDetails.update(
        updatedFields,
        {
            where: {
                countryIsoCode: countryIsoCode
            }
        }
    );

    return res
        .status(200)
        .json({ 
            success: true,
            message: "Country updated successfully" 
        });
  } catch (error) {
    return res
      .status(400)
      .json({ success: false, message: (error as Error).message });
  }
};

exports.deleteCountryByCountryIsoCode = async (req: Request, res: Response) => {
  try {
    const { countryIsoCode } = req.query;
    if (!countryIsoCode) {
        return res.status(400).json({ success: false, message: "Missing required 'countryIsoCode' query parameter" });
    }

    const existingCountry = await AllCountryDetails.findOne({
        where: { countryIsoCode: countryIsoCode }
    });

    if (!existingCountry) {
        return res.status(400).json({ success: false, message: "Country does not exist" }); 
    }

    await AllCountryDetails.destroy({
        where: { countryIsoCode: countryIsoCode }
    });

    return res
        .status(200)
        .json({ 
            success: true, 
            message: "Country deleted successfully" 
        });
  } catch (error) {
    return res
      .status(400)
      .json({ success: false, message: (error as Error).message });
  }
};