// ─────────────────────────────────────────────────────────────────────────────
// Sync Engine
// Drains the offline queue when network is available.
// Respects FIFO order + idempotency.
// ─────────────────────────────────────────────────────────────────────────────
import NetInfo from '@react-native-community/netinfo';
import api from '../api/client';
import { offlineQueue } from './queue';

class SyncEngine {
  private isSyncing = false;
  private unsubscribe: (() => void) | null = null;

  start(): void {
    this.unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected && state.isInternetReachable) {
        this.flush();
      }
    });
  }

  stop(): void {
    this.unsubscribe?.();
  }

  async flush(): Promise<void> {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      const pending = await offlineQueue.getPending(50);
      if (pending.length === 0) return;

      for (const op of pending) {
        await offlineQueue.markProcessing(op.id);
        try {
          const config = { headers: { 'X-Idempotency-Key': op.idempotency_key } };
          switch (op.method) {
            case 'POST':
              await api.post(op.endpoint, op.payload, config);
              break;
            case 'PATCH':
              await api.patch(op.endpoint, op.payload, config);
              break;
            case 'PUT':
              await api.put(op.endpoint, op.payload, config);
              break;
            case 'DELETE':
              await api.delete(op.endpoint, config);
              break;
          }
          await offlineQueue.markDone(op.id);
        } catch (err: any) {
          const msg = err?.response?.data?.message ?? err?.message ?? 'Unknown error';
          await offlineQueue.markFailed(op.id, msg);
          // Stop on conflict errors — don't push more if the queue has a bad state
          if (err?.response?.status === 409 || err?.response?.status === 422) break;
        }
      }
    } finally {
      this.isSyncing = false;
    }
  }
}

export const syncEngine = new SyncEngine();
