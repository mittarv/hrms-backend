const { dbOutput } = require("../models/index");

const UamToolsDetails = dbOutput.uamToolDetails;
const UamToolsUsers = dbOutput.uamToolUsers;
const UamUserGroupsModel = dbOutput.uamUserGroups;
const uamUserGroupsModel = require("../models/tools/uam/uamUserGroupsModel");
const e=require("express");
const { raw }=require("mysql2");


// exports.generateReferralCode = async (email, name, schemeCode) => {
//     if (email.includes("@mittarv.com")) {
//         const referralCode = email.substring(0, email.indexOf('.')).toUpperCase();
//         return referralCode;
//     }
//     var generate = true;
//     var referralCode;
//     while (generate) {
//         const initials = name == null ? 'AAAA' : name.substring(0, 4).padEnd(4, name[0]);
//         // Generate a random number between 1 and 9999, and pad it with leading zeros if necessary
//         const randomNumber = Math.floor(Math.random() * 9999) + 1;
//         const paddedNumber = randomNumber.toString().padStart(4, '0');
//         // Combine the initials and random number to form the referral code
//         referralCode = `${initials}${paddedNumber}${schemeCode}`.toUpperCase();
//         const isExisting = await UserReferralDetails.count({ where: { referralCode } });
//         if (isExisting == 0) generate = false;
//     }
//     return referralCode;
//     // Extract the first four letters of the name, or pad it with the first letter if it's less than 4 characters long
// }

function removeSpaces(str) {
    return str.replace(/\s+/g, '');
}

function generateRandomNumber(length) {
    let randomNumber = '';
    for (let i = 0; i < length; i++) {
        randomNumber += Math.floor(Math.random() * 10);
    }
    return parseInt(randomNumber, 10);
}

function generateRandomAlphabets(length) {
    var randomAlphabets = '';
    var alphabets = 'abcdefghijklmnopqrstuvwxyz';
    for (var i = 0; i < length; i++) {
        randomAlphabets += alphabets.charAt(Math.floor(Math.random() * alphabets.length));
    }
    return randomAlphabets;
}



// This fucntion is only responsible for generating a random 10-digit number,
// Regarding the appending of company code and iso code for customer Id, that will be done in create profile flow only.

exports.clearCacheOnApiCall = async () => {

};

// function to get all the tools access provided to a user
exports.getUserAllToolsAccess = async (user) => {
    const {userId, userType} = user;
    let userToolAccessMap = {};
    const role_value = {
        'No Access': 100,
        'User': 100,
        'Viewer': 200,
        'Editor': 300,
        'Tool Admin': 500
    }

    const allUamGroups = await UamUserGroupsModel.findAll();

    if(!allUamGroups || allUamGroups.length === 0) {
      return userToolAccessMap;
    }

    const allUamTools = await UamToolsDetails.findAll();

    if(!allUamTools || allUamTools.length === 0) {
      return userToolAccessMap;
    }

    const allUserAccess = await UamToolsUsers.findAll({
      where : { userId }
    });

    allUamTools.map((tool) => {
      const toolId = tool?.toolId;
      const toolName = tool?.name;

      const userAccess = allUserAccess.find((access) => access?.toolId === toolId);

      if(userType === 900) {
        userToolAccessMap[toolName] = 900;
      } else if(!userAccess) {
        userToolAccessMap[toolName] = 100;
      } else {
        const userGroupId = userAccess.userGroupId;
        const roleName = allUamGroups.find((group) => group?.id === userGroupId)?.role;
        const roleValue = role_value[roleName];

        userToolAccessMap[toolName] = roleValue;
      }
    });

    return userToolAccessMap;
}
