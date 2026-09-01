// Client sync service for Cloudflare Pages Functions
import { db, getDeviceOwnerKey } from "../db";

export interface SyncResult {
  success: boolean;
  message?: string;
  syncedCount?: number;
}

type SyncListener = (result: SyncResult) => void;

const MY_NICK_STORAGE = "ios_finance_my_nickname";
const PARTNER_NICK_STORAGE = "ios_finance_partner_name";
const LAST_SYNC_STORAGE = "ios_finance_last_sync_at";

class SyncService {
  private syncTimer: any = null;
  private listeners: Set<SyncListener> = new Set();
  private syncing: Promise<SyncResult> | null = null;

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

  /**
   * Per-device identity for shared ledger ownership.
   * A transaction belongs to whoever recorded it; the cloud keeps the
   * recorder's ownerKey so both devices resolve ownership the same way.
   * The key itself is generated in db/index.ts so the schema migration
   * stamps legacy records with the identical key.
   */
  public getOwnerKey(): string {
    return getDeviceOwnerKey();
  }

  /** True if this shared transaction was recorded (and paid) on this device. */
  public isMine(tx: { ownerId?: string }): boolean {
    // Records synced before the ownership model existed carry no ownerId;
    // treat them as locally recorded until the next push stamps them.
    if (!tx.ownerId) return true;
    return tx.ownerId === this.getOwnerKey();
  }

  public getMyNickname(): string {
    return localStorage.getItem(MY_NICK_STORAGE) || "我";
  }

  public setMyNickname(name: string): void {
    localStorage.setItem(MY_NICK_STORAGE, name.trim() || "我");
  }

  public getPartnerNickname(): string {
    return localStorage.getItem(PARTNER_NICK_STORAGE) || "宝贝";
  }

  public setPartnerNickname(name: string): void {
    localStorage.setItem(PARTNER_NICK_STORAGE, name.trim() || "宝贝");
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
   * Leave shared room and purge every local copy of the shared ledger.
   * The room itself (and its history) stays in the cloud, so rejoining with
   * the same pairing code restores the full record; this device simply
   * returns to a clean personal ledger.
   */
  public async leaveRoom(): Promise<number> {
    this.setRoomId(null);
    const removed = await db.transactions
      .filter((t) => (t.ledgerId || "personal") === "shared")
      .toArray();
    await db.transactions.bulkDelete(removed.map((t) => t.id!));
    return removed.length;
  }

  /** Timestamp (ms) of the last successful cloud sync on this device. */
  public getLastSyncAt(): number {
    return Number(localStorage.getItem(LAST_SYNC_STORAGE) || 0);
  }

  private setLastSyncAt(ts: number): void {
    localStorage.setItem(LAST_SYNC_STORAGE, String(ts));
  }

  /**
   * Trigger immediate bidirectional sync.
   * Concurrent calls (15s timer + visibilitychange + manual press) collapse
   * into one in-flight request so the cloud never sees overlapping merges.
   */
  public async syncNow(): Promise<SyncResult> {
    if (this.syncing) return this.syncing;
    this.syncing = this.runSyncCycle().finally(() => {
      this.syncing = null;
    });
    return this.syncing;
  }

  private async runSyncCycle(): Promise<SyncResult> {
    const roomId = this.getRoomId();
    if (!roomId) return { success: false, message: "未加入任何共享账本" };

    try {
      const ownerKey = this.getOwnerKey();

      // 1. Collect pending local shared transactions (including delete tombstones)
      const localSharedTxs = await db.transactions
        .filter((t) => t.ledgerId === "shared" && t.syncStatus === "pending")
        .toArray();

      // 1b. Stamp ownership: whoever records (and pays) it owns it
      for (const tx of localSharedTxs) {
        if (!tx.ownerId) {
          tx.ownerId = ownerKey;
          tx.ownerName = this.getMyNickname();
          await db.transactions.update(tx.id!, {
            ownerId: tx.ownerId,
            ownerName: tx.ownerName,
          });
        }
      }

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

        if (rTx.deletedAt) {
          // Remote tombstone: drop our local copy of this shared record
          if (existing) {
            await db.transactions.delete(existing.id!);
            updatedCount++;
          }
          continue;
        }

        if (!existing) {
          // Add new from partner; strip the remote device's auto-increment id so Dexie assigns our own
          const { id, ...cleanTx } = rTx;
          await db.transactions.add({
            ...cleanTx,
            remoteId: key,
            ledgerId: "shared",
            // The recorder's ownerId travels with the record so both devices agree on who paid
            ownerId: cleanTx.ownerId || "partner-device",
            ownerName: cleanTx.ownerName,
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
            ownerId: cleanTx.ownerId || existing.ownerId,
            syncStatus: "synced",
          });
          updatedCount++;
        }
      }

      // 4. Our own pending records (pushes & tombstones) made it to the cloud; flip them to synced
      const pendingCount = await db.transactions
        .filter((t) => t.ledgerId === "shared" && t.syncStatus === "pending")
        .count();
      if (pendingCount > 0) {
        await db.transactions
          .filter((t) => t.ledgerId === "shared" && t.syncStatus === "pending")
          .modify({ syncStatus: "synced" });
      }

      // 5. A full pull means our local list should mirror the cloud exactly;
      // purge any local record the cloud no longer knows (e.g. partner deleted it
      // while this device was offline for the tombstone push).
      const remoteKeys = new Set(
        remoteTxs.map((r) => r.remoteId || `${r.date}_${r.amount}_${r.note}_${r.createdAt}`)
      );
      const localShared = await db.transactions
        .filter((t) => t.ledgerId === "shared" && t.syncStatus !== "pending")
        .toArray();
      const staleLocal = localShared.filter((t) => t.remoteId && !remoteKeys.has(t.remoteId));
      if (staleLocal.length > 0) {
        await db.transactions.bulkDelete(staleLocal.map((t) => t.id!));
        updatedCount += staleLocal.length;
      }

      const result: SyncResult = {
        success: true,
        syncedCount: updatedCount,
        message: "同步成功",
      };
      this.setLastSyncAt(Date.now());
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
