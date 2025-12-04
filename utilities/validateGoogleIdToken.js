const { OAuth2Client } = require("google-auth-library");
const client = new OAuth2Client();

exports.verifyGoogleToken = async (idToken, tokens) => {
  try{
    //this code will be removed after 3 months
    if((tokens!=null||tokens!=undefined) && tokens.scope.includes('contacts')){
      await client.revokeToken(tokens.access_token);
    }
  const ticket = await client.verifyIdToken(
      {
    idToken: idToken,
    audience: [
      process.env.ANDROID_GOOGLE_CLIENT_ID_AUD,
      process.env.GOOGLE_CLIENT_ID,
      process.env.APPLE_GOOGLE_CLIENT_ID,
    ],
  });
  return ticket.getPayload();
  //   const response = await fetch(
  //     `https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=${idToken}`
  //   );
  //   const payload = await response.json();
  //   return payload;
  //   return ticket.getPayload();
}catch(err){
  console.log(err);
}
}


exports.googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, 'postmessage');
