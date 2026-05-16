import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/**
 * NotificationService — sends FCM push notifications via firebase-admin.
 *
 * SETUP:
 * 1. Create a Firebase project at https://console.firebase.google.com
 * 2. Project Settings > Service Accounts > Generate new private key
 * 3. Set env var: FIREBASE_SERVICE_ACCOUNT_JSON=<contents of JSON file>
 *    OR:         FIREBASE_SERVICE_ACCOUNT_PATH=<path to JSON file>
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
        const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
        const serviceAccount = JSON.parse(raw);
        // dotenv may keep \n as literal backslash-n inside the private_key string
        if (serviceAccount.private_key) {
          serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
        }
        credential = admin.credential.cert(serviceAccount);
      } else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
        credential = admin.credential.cert(serviceAccount);
      } else {
        this.logger.warn('Firebase not configured — FCM disabled. Set FIREBASE_SERVICE_ACCOUNT_JSON env var.');
        return;
      }
      admin.initializeApp({ credential });
      this.messaging = admin.messaging();
      this.logger.log('Firebase Admin initialized — FCM enabled');
    } catch (err) {
      this.logger.warn(`Firebase init failed: ${err}. FCM disabled.`);
    }
  }

  /** Send KC authorized notification to ALL active firm members (including the authorizer) */
  async sendKCAuthorized(opts: {
    firmId: string;
    authorizedBy: string;
    kcNumber: string;
    customerName: string;
    netPayable: string;
  }): Promise<void> {
    if (!this.messaging) return;

    const tokens = await this.getActiveTokens(opts.firmId);
    if (!tokens.length) return;

    const amount = parseFloat(opts.netPayable).toLocaleString('en-IN', {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    });

    await this.sendToTokens(
      tokens,
      `KC #${opts.kcNumber} Authorized ✅`,
      `${opts.customerName} — ₹${amount}`,
      { type: 'KC_AUTHORIZED', kc_number: opts.kcNumber, firm_id: opts.firmId },
    );
  }

  /** Generic: send to all active firm users except actor */
  async sendToFirmUsers(
    firmId: string,
    excludeUserId: string,
    title: string,
    body: string,
    data: Record<string, string>,
  ): Promise<void> {
    if (!this.messaging) return;
    const tokens = await this.getActiveTokens(firmId, excludeUserId);
    if (!tokens.length) return;
    await this.sendToTokens(tokens, title, body, data);
  }

  /** Get FCM tokens for all active firm users. Optionally excludes one user. */
  private async getActiveTokens(firmId: string, excludeUserId?: string): Promise<string[]> {
    if (excludeUserId) {
      const rows: Array<{ fcm_token: string }> = await this.dataSource.query(
        `SELECT fcm_token FROM users
         WHERE firm_id = $1 AND id != $2 AND is_active = true
           AND fcm_token IS NOT NULL AND fcm_token != ''`,
        [firmId, excludeUserId],
      );
      return rows.map(r => r.fcm_token);
    }
    const rows: Array<{ fcm_token: string }> = await this.dataSource.query(
      `SELECT fcm_token FROM users
       WHERE firm_id = $1 AND is_active = true
         AND fcm_token IS NOT NULL AND fcm_token != ''`,
      [firmId],
    );
    return rows.map(r => r.fcm_token);
  }

  private async sendToTokens(
    tokens: string[],
    title: string,
    body: string,
    data: Record<string, string>,
  ): Promise<void> {
    try {
      const response = await this.messaging.sendEachForMulticast({
        tokens,
        notification: { title, body },
        data,
        android: {
          priority: 'high',
          notification: {
            channelId: 'kc_updates',
            sound: 'default',
            icon: 'ic_stat_notification',
            color: '#1A6B3C',
          },
        },
        apns: {
          payload: { aps: { sound: 'default', badge: 1 } },
        },
      });

      this.logger.log(`FCM: ${response.successCount}/${tokens.length} delivered — "${title}"`);

      // Remove stale tokens
      response.responses.forEach((r: any, idx: number) => {
        if (!r.success && r.error?.code === 'messaging/registration-token-not-registered') {
          this.cleanupToken(tokens[idx]);
        }
      });
    } catch (err) {
      this.logger.error(`FCM sendEachForMulticast failed: ${err}`);
    }
  }

  private async cleanupToken(token: string): Promise<void> {
    try {
      await this.dataSource.query(`UPDATE users SET fcm_token = NULL WHERE fcm_token = $1`, [token]);
    } catch (_) {}
  }
}
