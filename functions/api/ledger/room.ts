// Cloudflare Pages Function: /api/ledger/room
// In-memory / ephemeral KV storage for pair rooms

interface Env {
  SHARED_LEDGER_KV?: any;
}

// In-memory fallback if KV is not bound
const memoryRooms = new Map<string, {
  roomId: string;
  createdAt: number;
  name: string;
  transactions: any[];
}>();

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body = await context.request.json() as { action: "create" | "join"; roomId?: string; name?: string };

    if (body.action === "create") {
      // Generate a friendly 6-character room code (e.g. LOVE88, 839210)
      const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const newRoom = {
        roomId: randomCode,
        createdAt: Date.now(),
        name: body.name || "恋爱共享账本",
        transactions: [],
      };

      try {
        if (context.env?.SHARED_LEDGER_KV) {
          await context.env.SHARED_LEDGER_KV.put(`room:${randomCode}`, JSON.stringify(newRoom), {
            expirationTtl: 60 * 60 * 24 * 365, // 1 year
          });
        } else {
          memoryRooms.set(randomCode, newRoom);
        }
      } catch {
        return new Response(JSON.stringify({
          success: false,
          message: "云端暂时无法创建房间（服务忙或今日配额已满），请稍后再试",
        }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        roomId: randomCode,
        roomName: newRoom.name,
        message: "房间创建成功",
      }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (body.action === "join") {
      const code = (body.roomId || "").trim().toUpperCase();
      if (!code) {
        return new Response(JSON.stringify({ success: false, message: "请输入有效的配对码" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      let roomData = null;
      if (context.env?.SHARED_LEDGER_KV) {
        const raw = await context.env.SHARED_LEDGER_KV.get(`room:${code}`);
        if (raw) roomData = JSON.parse(raw);
      } else {
        roomData = memoryRooms.get(code);
      }

      if (!roomData) {
        // If room does not exist yet, initialize it gracefully so either partner can join
        roomData = {
          roomId: code,
          createdAt: Date.now(),
          name: "恋爱共享账本",
          transactions: [],
        };
        try {
          if (context.env?.SHARED_LEDGER_KV) {
            await context.env.SHARED_LEDGER_KV.put(`room:${code}`, JSON.stringify(roomData));
          } else {
            memoryRooms.set(code, roomData);
          }
        } catch {
          // Join can still succeed for this session; the room record is only
          // metadata. A quota-limited KV shouldn't block pairing entirely.
        }
      }

      return new Response(JSON.stringify({
        success: true,
        roomId: code,
        roomName: roomData.name || "恋爱共享账本",
        message: "成功加入共享账本",
      }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: false, message: "未知操作" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, message: err.message || "服务器错误" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
