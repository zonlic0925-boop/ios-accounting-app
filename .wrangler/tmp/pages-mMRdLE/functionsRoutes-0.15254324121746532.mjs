import { onRequestPost as __api_ledger_room_ts_onRequestPost } from "C:\\Users\\Zonlic\\Desktop\\experiment\\记账APP\\functions\\api\\ledger\\room.ts"
import { onRequestPost as __api_ledger_sync_ts_onRequestPost } from "C:\\Users\\Zonlic\\Desktop\\experiment\\记账APP\\functions\\api\\ledger\\sync.ts"

export const routes = [
    {
      routePath: "/api/ledger/room",
      mountPath: "/api/ledger",
      method: "POST",
      middlewares: [],
      modules: [__api_ledger_room_ts_onRequestPost],
    },
  {
      routePath: "/api/ledger/sync",
      mountPath: "/api/ledger",
      method: "POST",
      middlewares: [],
      modules: [__api_ledger_sync_ts_onRequestPost],
    },
  ]