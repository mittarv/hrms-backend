const { OAuth2Client } = require("google-auth-library");
const client = new OAuth2Client();

exports.verifyGoogleToken = async (idToken) => {
  const ticket = await client.verifyIdToken({
    idToken: idToken,
    audience: [process.env.GOOGLE_CLIENT_ID],
  });
  return ticket.getPayload();
};

exports.googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  "postmessage"
);
