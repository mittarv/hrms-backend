const crypto = require("crypto");
const CryptoJS = require("crypto-js");

const generateHashedKey = (key) => {
  return CryptoJS.SHA512(key).toString();
};

module.exports = generateHashedKey;

// random iv
const generateIv = () => {
  try {
    return CryptoJS.lib.WordArray.random(16);
  } catch (error) {
    console.log(error);
  }
};

exports.encryptData = (data) => {
  try {
    const privateKey = process.env.AES_ENCRYPTION_KEY;

    const hashedKey = generateHashedKey(privateKey);

    const iv = generateIv();

    const encrypted = CryptoJS.AES.encrypt(JSON.stringify(data), hashedKey, {
      iv,
    }).toString();

    const ivHex = CryptoJS.enc.Hex.stringify(iv);

    return ivHex + encrypted; // embedding the iv in the encrypted message itself as a hexadecimal string
  } catch (error) {
    console.log(error);
  }
};

// This below functions uses AES-CBC with the prrivate key of 32 char long OR 256 bit long key
// For encryption
const encryptAESCBCData = (Plaintext) => {
  try {
    const key = process.env.AES_CBC_32_LENGTH_SYMMETRIC_ENCRYPTION_KEY; // 32 char long key
    const iv = crypto.randomBytes(16); // initialisation vector.( this is random in nature and will  be appended with a : between actual encrypted data)
    const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(key), iv); // create cipher object using the key and the generatedd iv
    let encrypted = cipher.update(Plaintext); // updating the the data using the generate ciper object
    encrypted = Buffer.concat([encrypted, cipher.final()]); // final encrypted data
    return iv.toString("base64") + ":" + encrypted.toString("base64"); // iv is converted to base64 and encrypted data is converted to base64 and returned
  } catch (error) {
    console.log("Expection : ", error);
  }
};

// For decryption not being used currently code was written for the verfication of the working of the ecrpytion and other validations 
const decryptAESCBCData = (encryptedBase64) => {
  try {
    const key = process.env.AES_CBC_32_LENGTH_SYMMETRIC_ENCRYPTION_KEY; // 32 char long key
    const [ivBase64, encryptedDataBase64] = encryptedBase64.split(":"); // split the iv and encrypted data using the special charater " : " put when encrypting
    const iv = Buffer.from(ivBase64, "base64"); // convert the iv to buffer
    const encryptedData = Buffer.from(encryptedDataBase64, "base64"); // convert the encrypted data to buffer
    const decipher = crypto.createDecipheriv(
      "aes-256-cbc",
      Buffer.from(key),
      iv
    ); // create decipher object using the key and the iv
    let decrypted = decipher.update(encryptedData); // update the encrypted data using the decipher object
    decrypted = Buffer.concat([decrypted, decipher.final()]); // final decrypted data
    return decrypted.toString(); // return the decrypted data
  } catch (error) {
    console.log("Expection : ", error);
  }
};

module.exports = { encryptAESCBCData, decryptAESCBCData };