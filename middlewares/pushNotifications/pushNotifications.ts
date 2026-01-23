import admin from "firebase-admin";

// Importing JSON requires "resolveJsonModule": true in tsconfig
import serviceAccount from "../../config/mittarv-signin-prod-firebase-adminsdk-z7s6o-5e40255269.json";
import { PushNotificationPayload } from "../../interfaces/platformInterfaces/interfaces/notificationInterface";

// Initialize Firebase Admin only once
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  });
}

export const sendPushNotification = async ({ token, title, body }: PushNotificationPayload): Promise<void> => {
  try {
    const message: admin.messaging.Message = {
      notification: {
        title,
        body,
      },
      token,
    };

    const response = await admin.messaging().send(message);

    console.log("Push notification sent successfully:", response);
  } catch (error) {
    console.error("Error sending push notification:", error);
  }
};
