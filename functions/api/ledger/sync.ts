// Cloudflare Pages Function: /api/ledger/sync
// Bidirectional sync backed by Cloudflare D1 (SQLite): row-level idempotent
// upserts keyed by (roomId, remoteId). Two devices recording at the same
// moment can no longer overwrite each other the way the old single-KV-key
// JSON blob did, there is no 60s eventual-consistency window, and the free
// write budget rises from ~1,000/day (KV) to 100,000/day (D1).
// The response contract is unchanged from the KV version.

interface Env {
  LEDGER_DB?: any; // D1Database binding from wrangler.toml
}

// Local-dev fallback when D1 is not bound (wrangler pages dev without --d1)
const memoryStore = new Map<string, any[]>();

const mergeKey = (tx: any): string =>
  tx.remoteId || `${tx.date}_${tx.amount}_${tx.note}_${tx.createdAt}`;

const jsonResponse = (data: any, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body = await context.request.json() as {
      roomId: string;
      lastSyncTimestamp?: number;
      pendingTransactions?: any[];
    };

    const roomId = (body.roomId || "").trim().toUpperCase();
    if (!roomId) {
      return jsonResponse({ success: false, message: "缺少 roomId" }, 400);
    }

    const db = context.env?.LEDGER_DB;
    if (db) {
      const incoming = body.pendingTransactions || [];

      // Push side: one batched upsert per incoming row. The WHERE guard keeps
      // only the newer write per merge key, so a duplicate or out-of-order
      // push can never regress an existing row.
      if (incoming.length > 0) {
        const stmt = db.prepare(
          `INSERT INTO ledger_tx (room_id, remote_id, payload, updated_at, deleted_at)
           VALUES (?1, ?2, ?3, ?4, ?5)
           ON CONFLICT(room_id, remote_id) DO UPDATE SET
             payload = excluded.payload,
             updated_at = excluded.updated_at,
             deleted_at = excluded.deleted_at
           WHERE excluded.updated_at >= ledger_tx.updated_at`
        );
        await db.batch(incoming.map((tx: any) => {
          // The recorder device's local auto-increment id is meaningless to
          // everyone else; (room_id, remote_id) is the identity that matters.
          const { id: _localId, ...persisted } = tx;
          return stmt.bind(
            roomId,
            mergeKey(tx),
            JSON.stringify(persisted),
            tx.updatedAt || tx.createdAt || 0,
            tx.deletedAt ?? null
          );
        }));
      }

      // Pull side: full room snapshot INCLUDING tombstones — the client
      // protocol deletes its local copy of any row carrying deletedAt.
      const { results } = await db.prepare(
        `SELECT payload FROM ledger_tx WHERE room_id = ?1 ORDER BY updated_at ASC`
      ).bind(roomId).all();
      const transactions = (results || []).map((r: any) => JSON.parse(r.payload));

      return jsonResponse({
        success: true,
        roomId,
        serverTime: Date.now(),
        transactions,
      });
    }

    // ---- Fallback below mirrors the legacy in-memory behaviour (dev only) ----
    let existingTransactions: any[] = memoryStore.get(roomId) || [];

    const incoming = body.pendingTransactions || [];
    const txMap = new Map<string, any>();
    for (const tx of existingTransactions) txMap.set(mergeKey(tx), tx);
    for (const inTx of incoming) {
      const key = mergeKey(inTx);
      const prev = txMap.get(key);
      if (!prev || (inTx.updatedAt || 0) >= (prev.updatedAt || 0)) {
        txMap.set(key, { ...inTx, remoteId: key, ledgerId: "shared" });
      }
    }
    const mergedList = Array.from(txMap.values());
    memoryStore.set(roomId, mergedList);

    return jsonResponse({
      success: true,
      roomId,
      serverTime: Date.now(),
      transactions: mergedList,
    });
  } catch (err: any) {
    return jsonResponse({ success: false, message: err.message || "同步服务错误" }, 500);
  }
};
