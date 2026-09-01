// Cloudflare Pages Function: /api/ledger/sync
// Incremental bidirectional sync for shared ledger transactions

interface Env {
  SHARED_LEDGER_KV?: any;
}

const memoryStore = new Map<string, any[]>();

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body = await context.request.json() as {
      roomId: string;
      lastSyncTimestamp?: number;
      pendingTransactions?: any[];
    };

    const roomId = (body.roomId || "").trim().toUpperCase();
    if (!roomId) {
      return new Response(JSON.stringify({ success: false, message: "缺少 roomId" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    let existingTransactions: any[] = [];
    if (context.env?.SHARED_LEDGER_KV) {
      const raw = await context.env.SHARED_LEDGER_KV.get(`transactions:${roomId}`);
      if (raw) existingTransactions = JSON.parse(raw);
    } else {
      existingTransactions = memoryStore.get(roomId) || [];
    }

    // Merge incoming pending transactions from this client
    const incoming = body.pendingTransactions || [];
    const txMap = new Map<string, any>();

    // Put existing in map
    for (const tx of existingTransactions) {
      const key = tx.remoteId || `${tx.date}_${tx.amount}_${tx.note}_${tx.createdAt}`;
      txMap.set(key, tx);
    }

    // Merge incoming, picking newer updatedAt
    for (const inTx of incoming) {
      const key = inTx.remoteId || `${inTx.date}_${inTx.amount}_${inTx.note}_${inTx.createdAt}`;
      const prev = txMap.get(key);
      if (!prev || (inTx.updatedAt || 0) >= (prev.updatedAt || 0)) {
        txMap.set(key, { ...inTx, remoteId: key, ledgerId: "shared" });
      }
    }

    const mergedList = Array.from(txMap.values());

    // Save back
    if (context.env?.SHARED_LEDGER_KV) {
      await context.env.SHARED_LEDGER_KV.put(`transactions:${roomId}`, JSON.stringify(mergedList));
    } else {
      memoryStore.set(roomId, mergedList);
    }

    // Filter transactions to return (all transactions for the shared room)
    return new Response(JSON.stringify({
      success: true,
      roomId,
      serverTime: Date.now(),
      transactions: mergedList,
    }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, message: err.message || "同步服务错误" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
