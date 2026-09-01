// Client sync service for Cloudflare Pages Functions
import { db } from "../db";

export interface SyncResult {
  success: boolean;
  message?: string;
  syncedCount?: number;
}

type SyncListener = (result: SyncResult) => void;

class SyncService {
  private syncTimer: any = null;
  private listeners: Set<SyncListener> = new Set();

  public getRoomId(): string | null {
    return localStorage.getItem("ios_finance_shared_room_id");
  }

  public setRoomId(roomId: string | null): void {
    if (roomId) {
      localStorage.setItem("ios_finance_shared_room_id", roomId.toUpperCase());
    } else {
      localStorage.removeItem("ios_finance_shared_room_id");
    }
  }

  public getPartnerNickname(): string {
    return localStorage.getItem("ios_finance_partner_name") || "女朋友";
  }

  public setPartnerNickname(name: string): void {
    localStorage.setItem("ios_finance_partner_name", name);
  }

  /**
   * Subscribe to completed sync cycles; returns an unsubscribe function.
   * Fired only on success with at least one locally applied change.
   */
  public onSync(listener: SyncListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(result: SyncResult): void {
    for (const fn of this.listeners) {
      try {
        fn(result);
      } catch {
        // A broken listener must never break the sync loop
      }
    }
  }

  /**
   * Create a new shared room code
   */
  public async createRoom(roomName: string = "恋爱共享账本"): Promise<{ success: boolean; roomId?: string; message: string }> {
    try {
      const res = await fetch("/api/ledger/room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", name: roomName }),
      });
      const data = await res.json();
      if (data.success && data.roomId) {
        this.setRoomId(data.roomId);
        return { success: true, roomId: data.roomId, message: data.message || "配对房间创建成功" };
      }
      return { success: false, message: data.message || "创建房间失败，请稍后重试" };
    } catch (err: any) {
      // A local-only room can never reach the partner's device, so offline creation fails honestly
      return { success: false, message: "网络连接失败，无法创建共享房间" };
    }
  }

  /**
   * Join an existing room with 6-character code
   */
  public async joinRoom(code: string): Promise<{ success: boolean; message: string }> {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return { success: false, message: "请输入有效的配对码" };

    try {
      const res = await fetch("/api/ledger/room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join", roomId: trimmed }),
      });
      const data = await res.json();
      if (data.success) {
        this.setRoomId(trimmed);
        await this.syncNow();
        return { success: true, message: data.message || "成功加入共享账本" };
      }
      return { success: false, message: data.message || "加入失败" };
    } catch (err: any) {
      return { success: false, message: "网络连接失败，请检查网络后重试" };
    }
  }

  /**
   * Leave shared room
   */
  public leaveRoom(): void {
    this.setRoomId(null);
  }

  /**
   * Trigger immediate bidirectional sync
   */
  public async syncNow(): Promise<SyncResult> {
    const roomId = this.getRoomId();
    if (!roomId) return { success: false, message: "未加入任何共享账本" };

    try {
      // 1. Collect pending local shared transactions
      const localSharedTxs = await db.transactions
        .filter((t) => t.ledgerId === "shared")
        .toArray();

      // 2. Call cloudflare pages function
      const res = await fetch("/api/ledger/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId,
          pendingTransactions: localSharedTxs,
        }),
      });

      if (!res.ok) {
        return { success: false, message: `网络响应错误: ${res.status}` };
      }

      const data = await res.json();
      if (!data.success || !Array.isArray(data.transactions)) {
        return { success: false, message: data.message || "同步失败" };
      }

      // 3. Upsert remote transactions into local Dexie
      const remoteTxs = data.transactions as any[];
      let updatedCount = 0;

      for (const rTx of remoteTxs) {
        const key = rTx.remoteId || `${rTx.date}_${rTx.amount}_${rTx.note}_${rTx.createdAt}`;
        const existing = await db.transactions.where("remoteId").equals(key).first();

        if (!existing) {
          // Add new from partner; strip the remote device's auto-increment id so Dexie assigns our own
          const { id, ...cleanTx } = rTx;
          await db.transactions.add({
            ...cleanTx,
            remoteId: key,
            ledgerId: "shared",
            syncStatus: "synced",
            createdAt: rTx.createdAt || Date.now(),
            updatedAt: rTx.updatedAt || Date.now(),
          });
          updatedCount++;
        } else if ((rTx.updatedAt || 0) > (existing.updatedAt || 0)) {
          // Update existing with newer remote (never touch the primary key)
          const { id, ...cleanTx } = rTx;
          await db.transactions.update(existing.id!, {
            ...cleanTx,
            remoteId: key,
            ledgerId: "shared",
            syncStatus: "synced",
          });
          updatedCount++;
        }
      }

      // 4. Our own pending records made it to the cloud; flip them to synced
      const pendingCount = await db.transactions
        .filter((t) => t.ledgerId === "shared" && t.syncStatus === "pending")
        .count();
      if (pendingCount > 0) {
        await db.transactions
          .filter((t) => t.ledgerId === "shared" && t.syncStatus === "pending")
          .modify({ syncStatus: "synced" });
      }

      const result: SyncResult = {
        success: true,
        syncedCount: updatedCount,
        message: "同步成功",
      };
      if (updatedCount > 0) this.emit(result);
      return result;
    } catch (err: any) {
      return { success: false, message: err.message || "同步异常" };
    }
  }

  /**
   * Start periodic auto sync (e.g. every 15s)
   */
  public startAutoSync(intervalMs: number = 15000): void {
    if (this.syncTimer) clearInterval(this.syncTimer);
    this.syncTimer = setInterval(() => {
      if (this.getRoomId()) {
        this.syncNow().catch(() => {});
      }
    }, intervalMs);
  }

  public stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }
}

export const syncService = new SyncService();
