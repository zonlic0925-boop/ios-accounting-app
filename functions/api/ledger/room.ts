// Cloudflare Pages Function: /api/ledger/room
// Pair-room create/join backed by Cloudflare D1 (SQLite). Rooms are durable —
// unlike the old KV entry they no longer expire after a year. The response
// contract is unchanged from the KV version.

interface Env {
  LEDGER_DB?: any; // D1Database binding from wrangler.toml
}

// Local-dev fallback when D1 is not bound (wrangler pages dev without --d1)
const memoryRooms = new Map<string, {
  roomId: string;
  createdAt: number;
  name: string;
}>();

const jsonResponse = (data: any, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body = await context.request.json() as { action: "create" | "join"; roomId?: string; name?: string };
    const db = context.env?.LEDGER_DB;

    if (body.action === "create") {
      // Generate a friendly 6-character room code (e.g. LOVE88, 839210)
      const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const roomName = body.name || "恋爱共享账本";

      try {
        if (db) {
          await db.prepare(
            `INSERT OR IGNORE INTO room (room_id, name, created_at) VALUES (?1, ?2, ?3)`
          ).bind(randomCode, roomName, Date.now()).run();
        } else {
          memoryRooms.set(randomCode, { roomId: randomCode, createdAt: Date.now(), name: roomName });
        }
      } catch {
        return jsonResponse({
          success: false,
          message: "云端暂时无法创建房间（服务忙），请稍后再试",
        }, 500);
      }

      return jsonResponse({
        success: true,
        roomId: randomCode,
        roomName,
        message: "房间创建成功",
      });
    }

    if (body.action === "join") {
      const code = (body.roomId || "").trim().toUpperCase();
      if (!code) {
        return jsonResponse({ success: false, message: "请输入有效的配对码" }, 400);
      }

      let roomName: string | null = null;
      if (db) {
        const row = await db.prepare(`SELECT name FROM room WHERE room_id = ?1`).bind(code).first<{ name: string }>();
        roomName = row?.name ?? null;
        if (!roomName) {
          // Initialize gracefully so either partner can join a fresh code;
          // INSERT OR IGNORE keeps this safe if both join simultaneously.
          try {
            await db.prepare(
              `INSERT OR IGNORE INTO room (room_id, name, created_at) VALUES (?1, ?2, ?3)`
            ).bind(code, "恋爱共享账本", Date.now()).run();
          } catch {
            // Join can still succeed; the room row is only metadata.
          }
          roomName = "恋爱共享账本";
        }
      } else {
        roomName = memoryRooms.get(code)?.name ?? null;
        if (!roomName) {
          memoryRooms.set(code, { roomId: code, createdAt: Date.now(), name: "恋爱共享账本" });
          roomName = "恋爱共享账本";
        }
      }

      return jsonResponse({
        success: true,
        roomId: code,
        roomName: roomName || "恋爱共享账本",
        message: "成功加入共享账本",
      });
    }

    return jsonResponse({ success: false, message: "未知操作" }, 400);
  } catch (err: any) {
    return jsonResponse({ success: false, message: err.message || "服务器错误" }, 500);
  }
};
