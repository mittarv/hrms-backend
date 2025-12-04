var sec = require('./rsa-wrapper');

exports.encryption = (message) => {
  return sec.encrypt(message);
};

exports.decryption = (ciphertext) => {
  return sec.decrypt(ciphertext);
};
