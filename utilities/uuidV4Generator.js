// the popular package uuid4 uses the inbuid crypto package of nodejs to generate uuid and hence directly using the randomUUID was seen to be 3x faster.
const { randomUUID } = require("crypto");

exports.createUUIDV4 = async function() {
  try {
    let uuid = randomUUID();
    return uuid;
  } catch (error) {
    console.log("error in generating the uuid av tool :", error);
    throw error;
  }
};
