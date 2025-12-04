const path = require('path');
const rsaWrapper = {};
const fs = require('fs');
const crypto = require('crypto');

const basePath = path.join(__dirname, '..');

// load keys from file
rsaWrapper.initLoadServerKeys = () => {
    rsaWrapper.serverPub = fs.readFileSync(path.resolve(basePath, 'keys', 'server.public.pem'));
    rsaWrapper.serverPrivate = fs.readFileSync(path.resolve(basePath, 'keys', 'server.private.pem'));
    rsaWrapper.clientPub = fs.readFileSync(path.resolve(basePath, 'keys', 'client.public.pem'));
};

/*
// Use this method only once and ensure you are storing the keys appropriately 
rsaWrapper.generate = (direction) => {
    let key = new NodeRSA();
    key.generateKeyPair(8192, 262148);
    fs.writeFileSync(path.resolve(__dirname, '../keys', direction + '.private.pem'), key.exportKey('pkcs8-private-pem'));
    fs.writeFileSync(path.resolve(__dirname, '../keys', direction + '.public.pem'), key.exportKey('pkcs8-public-pem'));

    return true;
};
*/

rsaWrapper.serverExampleEncrypt = () => {
    console.log('Server public encrypting');

    let enc = rsaWrapper.encrypt(rsaWrapper.serverPub, 'Server init hello');
    console.log('Encrypted RSA string ', '\n', enc);
    let dec = rsaWrapper.decrypt(rsaWrapper.serverPrivate, enc);
    console.log('Decrypted RSA string ...');
    console.log(dec);
};

rsaWrapper.encrypt = (message) => {
    console.log('starting encrypt:: ' + message);
    let enc = crypto.publicEncrypt({
        key: rsaWrapper.serverPub,
        padding: crypto.RSA_PKCS1_OAEP_PADDING
    }, Buffer.from(message.toString()));
    console.log('completed encrypt:: ' + enc.toString('base64'));
    return enc.toString('base64');
};

rsaWrapper.decrypt = (message) => {
    console.log('starting decrypt:: ' + message);
    let enc = crypto.privateDecrypt({
        key: rsaWrapper.serverPrivate,
        padding: crypto.RSA_PKCS1_OAEP_PADDING
    }, Buffer.from(message, 'base64'));
    console.log('completed decrypt:: ' + enc.toString());
    return enc.toString();
};

module.exports = rsaWrapper;