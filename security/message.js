const { encryption } = require("./encryptDecrypt");

const success = (data1, data2) => {
  if (process.env.ENCRYPTION === "true") {
    var value = {};
    var temp1 = encryption("success");
    var temp2 = encryption("message");
    value[temp1] = encryption(data1);
    value[temp2] = encryption(data2);
  } else {
    value = { success: data1, message: data2 };
  }
  return value;
};

module.exports = success;
