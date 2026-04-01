# Firebase Cloud Functions for Push Notifications

## Setup

1. Initialize Firebase Cloud Functions in your project:
```bash
firebase init functions
```

2. Install dependencies:
```bash
cd functions
npm install firebase-admin firebase-functions
```

3. Deploy the function:
```bash
firebase deploy --only functions
```

## Cloud Function Code

Create `functions/index.js`:

```javascript
const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

/**
 * Triggered when a new notification is created in Firestore.
 * Sends FCM push notifications to all users in the organization.
 */
exports.sendPushNotification = functions.firestore
  .document('notifications/{notificationId}')
  .onCreate(async (snap, context) => {
    const notification = snap.data();
    const organizationId = notification.organizationId;
    
    if (!organizationId) {
      console.log('No organizationId found, skipping push');
      return null;
    }

    try {
      // Get all FCM tokens for users in this organization
      const employeesSnapshot = await admin.firestore()
        .collection('employees')
        .where('organizationId', '==', organizationId)
        .get();

      const userIds = employeesSnapshot.docs.map(doc => doc.data().userId).filter(Boolean);

      // Get FCM tokens for these users (only if push is enabled)
      const tokenPromises = userIds.map(async (userId) => {
        // Check if user has push enabled
        const prefDoc = await admin.firestore()
          .collection('push_preferences')
          .doc(userId)
          .get();
        
        if (!prefDoc.exists || !prefDoc.data().enabled) return [];

        const tokensSnapshot = await admin.firestore()
          .collection('fcm_tokens')
          .where('userId', '==', userId)
          .get();
        
        return tokensSnapshot.docs.map(doc => doc.data().token);
      });

      const tokenArrays = await Promise.all(tokenPromises);
      const tokens = tokenArrays.flat().filter(Boolean);

      if (tokens.length === 0) {
        console.log('No FCM tokens found for organization');
        return null;
      }

      // Build the FCM message
      const message = {
        notification: {
          title: notification.type === 'birthday' 
            ? `🎂 ${notification.title}` 
            : `📢 ${notification.title}`,
          body: notification.message,
        },
        data: {
          type: notification.type || 'general',
          notificationId: context.params.notificationId,
          tag: `${notification.type}-${context.params.notificationId}`,
          url: '/dashboard',
        },
        tokens: tokens,
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      
      console.log(`Push sent: ${response.successCount} success, ${response.failureCount} failures`);

      // Clean up invalid tokens
      if (response.failureCount > 0) {
        const failedTokens = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            failedTokens.push(tokens[idx]);
          }
        });

        // Remove invalid tokens from Firestore
        for (const token of failedTokens) {
          const tokenDocs = await admin.firestore()
            .collection('fcm_tokens')
            .where('token', '==', token)
            .get();
          
          for (const doc of tokenDocs.docs) {
            await doc.ref.delete();
          }
        }
      }

      return null;
    } catch (error) {
      console.error('Error sending push notifications:', error);
      return null;
    }
  });

/**
 * Triggered when a leave request status changes.
 * Sends push notification to the requesting employee.
 */
exports.sendLeaveStatusNotification = functions.firestore
  .document('leave_requests/{requestId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    // Only trigger when status changes
    if (before.status === after.status) return null;

    const userId = after.userId;
    if (!userId) return null;

    try {
      // Check push preference
      const prefDoc = await admin.firestore()
        .collection('push_preferences')
        .doc(userId)
        .get();
      
      if (!prefDoc.exists || !prefDoc.data().enabled) return null;

      // Get FCM tokens
      const tokensSnapshot = await admin.firestore()
        .collection('fcm_tokens')
        .where('userId', '==', userId)
        .get();

      const tokens = tokensSnapshot.docs.map(doc => doc.data().token).filter(Boolean);
      if (tokens.length === 0) return null;

      const statusEmoji = after.status === 'approved' ? '✅' : '❌';
      
      const message = {
        notification: {
          title: `${statusEmoji} Leave ${after.status.charAt(0).toUpperCase() + after.status.slice(1)}`,
          body: `Your ${after.leaveType || 'leave'} request has been ${after.status}.`,
        },
        data: {
          type: 'leave_status',
          url: '/leave',
          tag: `leave-${context.params.requestId}`,
        },
        tokens: tokens,
      };

      await admin.messaging().sendEachForMulticast(message);
      return null;
    } catch (error) {
      console.error('Error sending leave notification:', error);
      return null;
    }
  });

/**
 * Scheduled function to send attendance reminders.
 * Runs daily at 9:00 AM and 6:00 PM IST.
 */
exports.sendAttendanceReminder = functions.pubsub
  .schedule('0 9,18 * * 1-6')  // 9 AM and 6 PM, Mon-Sat
  .timeZone('Asia/Kolkata')
  .onRun(async (context) => {
    const hour = new Date().toLocaleString('en-US', { 
      timeZone: 'Asia/Kolkata', 
      hour: 'numeric', 
      hour12: false 
    });
    
    const isPunchIn = parseInt(hour) < 12;

    try {
      // Get all users with push enabled
      const prefsSnapshot = await admin.firestore()
        .collection('push_preferences')
        .where('enabled', '==', true)
        .get();

      const userIds = prefsSnapshot.docs.map(doc => doc.data().userId);

      // Get all tokens
      const allTokens = [];
      for (const userId of userIds) {
        const tokensSnapshot = await admin.firestore()
          .collection('fcm_tokens')
          .where('userId', '==', userId)
          .get();
        
        tokensSnapshot.docs.forEach(doc => {
          allTokens.push(doc.data().token);
        });
      }

      if (allTokens.length === 0) return null;

      const message = {
        notification: {
          title: isPunchIn ? '⏰ Time to Punch In!' : '⏰ Time to Punch Out!',
          body: isPunchIn 
            ? 'Good morning! Don\'t forget to mark your attendance.'
            : 'It\'s time to punch out. Have a great evening!',
        },
        data: {
          type: 'attendance_reminder',
          url: '/attendance',
          tag: `attendance-${isPunchIn ? 'in' : 'out'}`,
        },
        tokens: allTokens,
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      console.log(`Attendance reminders sent: ${response.successCount} success`);
      
      return null;
    } catch (error) {
      console.error('Error sending attendance reminders:', error);
      return null;
    }
  });
```

## VAPID Key Setup

1. Go to **Firebase Console** → **Project Settings** → **Cloud Messaging**
2. Under **Web Push certificates**, click **Generate key pair**
3. Copy the **Key pair** value
4. Paste it in `src/lib/pushNotificationService.ts` as the `VAPID_KEY` constant

## Firestore Collections

The push notification system uses these Firestore collections:

- **`push_preferences`** — User push notification on/off preference
  - `userId`: string
  - `enabled`: boolean
  - `updatedAt`: string (ISO)

- **`fcm_tokens`** — FCM device tokens for each user
  - `userId`: string
  - `token`: string (FCM token)
  - `createdAt`: string (ISO)
  - `userAgent`: string
  - `platform`: string

## Firestore Rules

Add these rules to your `firestore.rules`:

```
match /push_preferences/{userId} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}

match /fcm_tokens/{tokenId} {
  allow read, write: if request.auth != null;
}
```
