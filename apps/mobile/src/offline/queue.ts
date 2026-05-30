// ─────────────────────────────────────────────────────────────────────────────
// Offline Operation Queue
// SQLite-backed FIFO queue for offline mutations.
// Each operation is idempotent (idempotency_key) so replays are safe.
//
// linked_ops: optional follow-up operations that depend on the parent's
// response. Endpoint templates use {id} which is replaced by the parent
// response body's `id` field at sync time.
// ─────────────────────────────────────────────────────────────────────────────
import SQLite from 'react-native-sqlite-storage';
import { v4 as uuidv4 } from 'uuid';

SQLite.enablePromise(true);

export type OperationStatus = 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED' | 'DEAD_LETTER';

/** A follow-up operation chained after its parent succeeds. */
export interface LinkedOp {
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Endpoint template — `{id}` is replaced with the parent response body's `id` field. */
  endpoint_template: string;
  payload: object | null;
  idempotency_key: string;
}

export interface QueuedOperation {
  id: string;
  idempotency_key: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  endpoint: string;
  payload: object | null;
  /** Parsed LinkedOp array (null when none). Stored as JSON text in SQLite. */
  linked_ops: LinkedOp[] | null;
  status: OperationStatus;
  retry_count: number;
  last_error?: string;
  created_at: string;
}

class OfflineQueue {
  private db: SQLite.SQLiteDatabase | null = null;

  async init(): Promise<void> {
    this.db = await SQLite.openDatabase({ name: 'smart_mandi_offline.db', location: 'default' });
    await this.db.executeSql(`
      CREATE TABLE IF NOT EXISTS operation_queue (
        id              TEXT PRIMARY KEY,
        idempotency_key TEXT NOT NULL UNIQUE,
        method          TEXT NOT NULL,
        endpoint        TEXT NOT NULL,
        payload         TEXT,
        linked_ops      TEXT,
        status          TEXT NOT NULL DEFAULT 'PENDING',
        retry_count     INTEGER NOT NULL DEFAULT 0,
        last_error      TEXT,
        created_at      TEXT NOT NULL
      )
    `);
    // Add linked_ops column to existing DBs (idempotent)
    await this.db.executeSql(
      `ALTER TABLE operation_queue ADD COLUMN linked_ops TEXT`,
    ).catch(() => {}); // column already exists — safe to ignore
    await this.db.executeSql(`
      CREATE INDEX IF NOT EXISTS idx_queue_status ON operation_queue(status, created_at)
    `);
  }

  async enqueue(
    method: QueuedOperation['method'],
    endpoint: string,
    payload: object | null,
    idempotencyKey?: string,
    linkedOps?: LinkedOp[],
  ): Promise<string> {
    await this.ensureInit();
    const id = uuidv4();
    const key = idempotencyKey ?? uuidv4();
    const now = new Date().toISOString();
    const linkedJson = linkedOps && linkedOps.length > 0 ? JSON.stringify(linkedOps) : null;

    await this.db!.executeSql(
      `INSERT OR IGNORE INTO operation_queue
         (id, idempotency_key, method, endpoint, payload, linked_ops, status, retry_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'PENDING', 0, ?)`,
      [id, key, method, endpoint, payload ? JSON.stringify(payload) : null, linkedJson, now],
    );

    return id;
  }

  async getPending(limit = 50): Promise<QueuedOperation[]> {
    await this.ensureInit();
    const [results] = await this.db!.executeSql(
      `SELECT * FROM operation_queue WHERE status = 'PENDING' ORDER BY created_at ASC LIMIT ?`,
      [limit],
    );
    return this.rowsToOps(results);
  }

  async markProcessing(id: string): Promise<void> {
    await this.ensureInit();
    await this.db!.executeSql(`UPDATE operation_queue SET status = 'PROCESSING' WHERE id = ?`, [id]);
  }

  /** Reset items stuck in PROCESSING after app crash — call on sync engine start */
  async resetStuck(): Promise<void> {
    await this.ensureInit();
    await this.db!.executeSql(
      `UPDATE operation_queue SET status = 'PENDING' WHERE status = 'PROCESSING'`,
    );
  }

  async markDone(id: string): Promise<void> {
    await this.ensureInit();
    await this.db!.executeSql(`UPDATE operation_queue SET status = 'DONE' WHERE id = ?`, [id]);
  }

  async markFailed(id: string, error: string): Promise<void> {
    await this.ensureInit();
    await this.db!.executeSql(
      `UPDATE operation_queue SET status = CASE WHEN retry_count >= 3 THEN 'DEAD_LETTER' ELSE 'PENDING' END,
       retry_count = retry_count + 1, last_error = ? WHERE id = ?`,
      [error, id],
    );
  }

  async getDeadLetters(): Promise<QueuedOperation[]> {
    await this.ensureInit();
    const [results] = await this.db!.executeSql(
      `SELECT * FROM operation_queue WHERE status = 'DEAD_LETTER' ORDER BY created_at DESC`,
    );
    return this.rowsToOps(results);
  }

  async getPendingCount(): Promise<number> {
    await this.ensureInit();
    const [results] = await this.db!.executeSql(
      `SELECT COUNT(*) as cnt FROM operation_queue WHERE status = 'PENDING'`,
    );
    return results.rows.item(0).cnt ?? 0;
  }

  private async ensureInit(): Promise<void> {
    if (!this.db) await this.init();
  }

  private rowsToOps(results: SQLite.ResultSet): QueuedOperation[] {
    const ops: QueuedOperation[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      const row = results.rows.item(i);
      ops.push({
        ...row,
        payload: row.payload ? JSON.parse(row.payload) : null,
        linked_ops: row.linked_ops ? JSON.parse(row.linked_ops) : null,
      });
    }
    return ops;
  }
}

export const offlineQueue = new OfflineQueue();
