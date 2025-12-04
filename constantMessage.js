const responseMessages = {
  "no data": "No data found",
  "no user": "User not found",
  "no connection": "No connection found",
  "no recipient": "No recipient found",
  opt: "OTP sent to your email",
  "invalid otp": "Invalid OTP",
  "otp verified": "OTP verified",
  "otp expired": "OTP expired",
  "all fields required": "Please fill all the fields",
  "profile create": "Profile created successfully",
  "already exist": "User already exist",
  "user does not exist": "User does not exist",
  "profile updated": "Profile updated successfully",
};
const notificationTitles = {
  "will created": "New Will Received!",
  "asset created": "Asset has been Shared with you!",
  "group created": "Group Shared - Your Legacy Continues to Grow!",
  "primary trusted Contact": "Primary trusted contacts status updated",
  "trusted Contact updated": "Trusted contact status updated",
  "welcome": "Welcome to Mitt Arv!",
};

const notificationBodies = {
  "will created":
    "You’ve received a will from Ryan Howard. Create one back for them and keep your legacy alive. ",
};
module.exports = {
  responseMessages,
  notificationTitles,
  notificationBodies,
};

// table=>notificationTypesandBody{
//   type:"will_created"
//   body:"You’ve received a will from Ryan Howard. Create one back for them and keep your legacy alive. "
//   title:
//   icon:
// }
