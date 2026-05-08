import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/**
 * NotificationService — sends FCM push notifications via firebase-admin.
 *
 * SETUP REQUIRED before production:
 * 1. Create a Firebase project at https://console.firebase.google.com
 * 2. Go to Project Settings > Service Accounts > Generate new private key
 * 3. Save as apps/api/firebase-service-account.json (add to .gitignore!)
 * 4. Set FIREBASE_SERVICE_ACCOUNT_PATH env var to the path
 *    OR set FIREBASE_SERVICE_ACCOUNT_JSON env var to the JSON string
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private messaging: any = null;

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {
    this.initFirebase();
  }

  private initFirebase(): void {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const admin = require('firebase-admin');
      if (admin.apps.length > 0) {
        this.messaging = admin.messaging();
        return;
      }
      let credential: any;
      if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
        credential = admin.credential.cert(serviceAccount);
      } else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
        credential = admin.credential.cert(serviceAccount);
      } else {
        this.logger.warn(
          'Firebase not configured — FCM notifications disabled. ' +
          'Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH env var.',
        );
        return;
      }
      admin.initializeApp({ credential });
      this.messaging = admin.messaging();
      this.logger.log('Firebase Admin initialized — FCM enabled');
    } catch (err) {
      this.logger.warn(`Firebase init failed: ${err}. FCM notifications disabled.`);
    }
  }

  /** Send push notification to all users in a firm (except the actor) */
  async sendToFirmUsers(
    firmId: string,
    excludeUserId: string,
    title: string,
    body: string,
    data: Record<string, string>,
  ): Promise<void> {
    if (!this.messaging) return;

    const tokens: Array<{ fcm_token: string }> = await this.dataSource.query(
      `SELECT fcm_token FROM users
       WHERE firm_id = $1 AND id != $2 AND is_active = true AND fcm_token IS NOT NULL`,
      [firmId, excludeUserId],
    );

    if (tokens.length === 0) return;

    const fcmTokens = tokens.map(t => t.fcm_token);
    this.logger.log(`Sending FCM to ${fcmTokens.length} users in firm ${firmId}`);

    try {
      const response = await this.messaging.sendEachForMulticast({
        tokens: fcmTokens,
        notification: { title, body },
        data,
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default', badge: 1 } } },
      });
      this.logger.log(`FCM sent: ${response.successCount} success, ${response.failureCount} failed`);
    } catch (err) {
      this.logger.error(`FCM send failed: ${err}`);
    }
  }
}
