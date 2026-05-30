// ─────────────────────────────────────────────────────────────────────────────
// Sync Engine
// Drains the offline queue when network is available.
// Respects FIFO order + idempotency.
// Supports linked_ops: follow-up operations whose endpoint template is
// resolved using the parent operation's response (e.g. /kcs/{id}/payments).
// ─────────────────────────────────────────────────────────────────────────────
import NetInfo from '@react-native-community/netinfo';
import api from '../api/client';
import { offlineQueue, LinkedOp } from './queue';

class SyncEngine {
  private isSyncing = false;
  private unsubscribe: (() => void) | null = null;

  start(): void {
    // Reset any operations stuck in PROCESSING from a previous crash/kill
    offlineQueue.resetStuck().catch(() => {});
    this.unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected && state.isInternetReachable !== false) {
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
          let response: any;
          switch (op.method) {
            case 'POST':
              response = await api.post(op.endpoint, op.payload, config);
              break;
            case 'PATCH':
              response = await api.patch(op.endpoint, op.payload, config);
              break;
            case 'PUT':
              response = await api.put(op.endpoint, op.payload, config);
              break;
            case 'DELETE':
              response = await api.delete(op.endpoint, config);
              break;
          }
          await offlineQueue.markDone(op.id);

          // Resolve and enqueue any linked operations (e.g. KC payments after KC create)
          if (op.linked_ops && op.linked_ops.length > 0) {
            // API may wrap response in { data: {...} } — unwrap both patterns
            const responseData: Record<string, unknown> =
              response?.data?.data ?? response?.data ?? {};
            await this.enqueueLinkedOps(op.linked_ops, responseData);
          }
        } catch (err: any) {
          const msg = err?.response?.data?.message ?? err?.message ?? 'Unknown error';
          await offlineQueue.markFailed(op.id, msg);
          // Stop on conflict / unprocessable — avoid pushing dependent ops into bad state
          if (err?.response?.status === 409 || err?.response?.status === 422) break;
        }
      }
    } finally {
      this.isSyncing = false;
    }
  }

  /** Replace {key} placeholders in endpoint templates with values from the parent response. */
  private async enqueueLinkedOps(
    linkedOps: LinkedOp[],
    responseData: Record<string, unknown>,
  ): Promise<void> {
    for (const linked of linkedOps) {
      const resolvedEndpoint = linked.endpoint_template.replace(
        /\{([^}]+)\}/g,
        (_, key: string) => String(responseData[key] ?? ''),
      );
      // Skip if any placeholder is still unresolved
      if (resolvedEndpoint.includes('{')) continue;
      await offlineQueue.enqueue(
        linked.method,
        resolvedEndpoint,
        linked.payload,
        linked.idempotency_key,
      );
    }
  }
}

export const syncEngine = new SyncEngine();
