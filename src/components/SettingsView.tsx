import React, { useState } from "react";
import {
  Globe,
  RefreshCw,
  Upload,
  Download,
  RotateCcw,
  Sun,
  Volume2,
  VolumeX,
  ChevronRight,
  Check,
  Heart,
  User,
  Users,
  Copy,
  ArrowRightLeft,
  CheckCircle2,
  LogOut,
  Mail,
  Star,
  Coffee,
  Code2,
} from "lucide-react";
import { getBaseCurrencyOptions, getCurrencyInfo } from "../services/currency";
import { syncService } from "../services/syncService";
import { haptics } from "../lib/haptics";

const AUTHOR_NAME = "Zonlic";
const AUTHOR_BIO = "一个在香港生活的普通人";
const AUTHOR_EMAIL = "zonlic0925@gmail.com";
const GITHUB_URL = "https://github.com/zonlic0925-boop/ios-accounting-app";

interface SettingsViewProps {
  baseCurrency: string;
  rates: Record<string, number>;
  theme: "light" | "dark" | "system";
  soundEnabled: boolean;
  onCurrencyChange: (currency: string) => Promise<void>;
  onThemeChange: (theme: "light" | "dark" | "system") => void;
  onToggleSound: () => void;
  onRefreshRates: () => Promise<void>;
  onExportCSV: () => void;
  onImportCSV: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  onResetData: () => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  baseCurrency,
  rates,
  theme,
  soundEnabled,
  onCurrencyChange,
  onThemeChange,
  onToggleSound,
  onRefreshRates,
  onExportCSV,
  onImportCSV,
  onResetData,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showDonate, setShowDonate] = useState(false);

  // Cloud Sync & Couple Room States
  const [roomId, setRoomId] = useState<string | null>(syncService.getRoomId());
  const [inputCode, setInputCode] = useState("");
  const [isPairing, setIsPairing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);

  // Nicknames: what I call myself and what I call my partner
  const [myNickname, setMyNickname] = useState(syncService.getMyNickname());
  const [partnerNickname, setPartnerNickname] = useState(syncService.getPartnerNickname());

  const lastSyncAt = syncService.getLastSyncAt();
  const lastSyncLabel = lastSyncAt
    ? `上次对齐：${new Date(lastSyncAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}。`
    : "本机尚未与云端对齐过。";

  const handleSaveNicknames = () => {
    syncService.setMyNickname(myNickname);
    syncService.setPartnerNickname(partnerNickname);
    haptics.success();
    setSyncStatusMsg("称呼已更新");
    setTimeout(() => setSyncStatusMsg(""), 4000);
  };

  const handleCreateRoom = async () => {
    haptics.light();
    setIsPairing(true);
    try {
      syncService.setMyNickname(myNickname);
      syncService.setPartnerNickname(partnerNickname);
      const res = await syncService.createRoom();
      if (res.success && res.roomId) {
        setRoomId(res.roomId);
        haptics.success();
        setSyncStatusMsg("配对码已生成");
      }
    } finally {
      setIsPairing(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!inputCode.trim()) return;
    haptics.light();
    setIsPairing(true);
    try {
      syncService.setMyNickname(myNickname);
      syncService.setPartnerNickname(partnerNickname);
      const res = await syncService.joinRoom(inputCode);
      if (res.success) {
        setRoomId(inputCode.trim().toUpperCase());
        setInputCode("");
        haptics.success();
        setSyncStatusMsg("已加入共享账本");
      } else {
        haptics.error();
        setSyncStatusMsg(res.message);
      }
    } finally {
      setIsPairing(false);
    }
  };

  const handleManualSync = async () => {
    haptics.selection();
    setIsSyncing(true);
    try {
      const res = await syncService.syncNow();
      if (res.success) {
        haptics.success();
        setSyncStatusMsg(`同步完成 (更新 ${res.syncedCount || 0} 笔)`);
        setTimeout(() => setSyncStatusMsg(""), 4000);
      } else {
        haptics.error();
        setSyncStatusMsg(res.message || "同步失败");
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const [isLeaving, setIsLeaving] = useState(false);

  const handleLeaveRoom = async () => {
    if (isLeaving) return;
    if (!window.confirm("退出后本机将清空恋爱共享账目的本地副本，云端记录保留。确定退出？")) {
      return;
    }
    haptics.medium();
    setIsLeaving(true);
    try {
      const removed = await syncService.leaveRoom();
      setRoomId(null);
      setSyncStatusMsg(`已退出共享账本，本机清除 ${removed} 笔共享流水`);
      window.setTimeout(() => setSyncStatusMsg(""), 6000);
    } finally {
      setIsLeaving(false);
    }
  };

  const handleCopyCode = () => {
    if (!roomId) return;
    navigator.clipboard.writeText(roomId);
    haptics.selection();
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleRefresh = async () => {
    haptics.selection();
    setIsRefreshing(true);
    try {
      await onRefreshRates();
      haptics.success();
      setRefreshSuccess(true);
      setTimeout(() => setRefreshSuccess(false), 3000);
    } catch {
      haptics.error();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCurrencySelect = async (code: string) => {
    haptics.selection();
    await onCurrencyChange(code);
  };

  // All supported currencies list
  // Curated world-major base currencies. If a previously chosen base falls
  // outside the six (picked before the list was trimmed), append it so the
  // current selection stays visible and selectable instead of silently
  // de-highlighting.
  const baseOptions = getBaseCurrencyOptions();
  const currencyList = baseOptions.some((c) => c.code === baseCurrency)
    ? baseOptions
    : [...baseOptions, getCurrencyInfo(baseCurrency)];

  return (
    <div className="space-y-5 pb-20">
      {/* Title */}
      <div className="px-1">
        <h1 className="text-xl font-bold text-black dark:text-white">系统设置</h1>
        <p className="text-xs text-ios-gray-1 mt-0.5">
          偏好设置、多币种折算基准与数据备份管理
        </p>
      </div>

      {/* Group 0: Couple Shared Ledger & Cloud Sync */}
      <div className="space-y-2">
        <span className="text-xs font-bold text-ios-pink uppercase tracking-wider px-2 flex items-center space-x-1">
          <Heart className="w-3 h-3 fill-ios-pink" />
          <span>恋爱双人共享记账 (Cloud Sync)</span>
        </span>

        <div className="bg-white dark:bg-[#1C1C1E] rounded-3xl overflow-hidden shadow-ios-card border border-black/[0.04] dark:border-white/[0.06] divide-y divide-black/[0.04] dark:divide-white/[0.04]">
          {/* Nicknames: used across shared ledger badges & settlement */}
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-ios-gray-1 flex items-center space-x-1">
                  <User className="w-3 h-3 text-ios-blue" />
                  <span>我的称呼</span>
                </label>
                <input
                  type="text"
                  value={myNickname}
                  onChange={(e) => setMyNickname(e.target.value)}
                  placeholder="我"
                  maxLength={8}
                  className="w-full px-3 py-2 text-xs bg-ios-gray-6 dark:bg-ios-gray-dark4 rounded-xl border border-black/[0.04] dark:border-white/[0.06] text-black dark:text-white outline-none focus:border-ios-blue"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-ios-gray-1 flex items-center space-x-1">
                  <Heart className="w-3 h-3 text-ios-pink fill-ios-pink" />
                  <span>备注对方</span>
                </label>
                <input
                  type="text"
                  value={partnerNickname}
                  onChange={(e) => setPartnerNickname(e.target.value)}
                  placeholder="宝贝"
                  maxLength={8}
                  className="w-full px-3 py-2 text-xs bg-ios-gray-6 dark:bg-ios-gray-dark4 rounded-xl border border-black/[0.04] dark:border-white/[0.06] text-black dark:text-white outline-none focus:border-ios-pink"
                />
              </div>
            </div>
            <p className="text-[11px] text-ios-gray-2 leading-relaxed">
              共享账本里各自记自己出的钱，对方看到的就是「{partnerNickname || "宝贝"}出的」。
            </p>
            <button
              type="button"
              onClick={handleSaveNicknames}
              className="w-full py-2 rounded-xl bg-ios-gray-5 dark:bg-ios-gray-dark3 text-xs font-semibold text-ios-blue hover:bg-ios-blue hover:text-white transition-all cursor-pointer"
            >
              保存称呼
            </button>
          </div>

          {roomId ? (
            /* Paired State */
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-2xl bg-ios-pink/10 text-ios-pink flex items-center justify-center">
                    <Heart className="w-4 h-4 fill-ios-pink" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-black dark:text-white flex items-center space-x-1.5">
                      <span>情侣空间已连接</span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-ios-green" />
                    </div>
                    <p className="text-xs text-ios-gray-1 mt-0.5">
                      房间配对码: <span className="font-mono font-bold text-ios-pink">{roomId}</span>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="p-2 rounded-xl bg-ios-gray-5 dark:bg-ios-gray-dark4 text-ios-gray-1 hover:text-black dark:hover:text-white transition-all cursor-pointer"
                  title="复制配对码"
                >
                  {copiedCode ? <Check className="w-4 h-4 text-ios-green" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              {syncStatusMsg && (
                <div className="text-xs text-ios-green dark:text-ios-green bg-ios-green/10 px-3 py-1.5 rounded-xl text-center">
                  {syncStatusMsg}
                </div>
              )}

              <div className="flex space-x-2 pt-1">
                <button
                  type="button"
                  onClick={handleManualSync}
                  disabled={isSyncing}
                  className="flex-1 py-2.5 rounded-2xl bg-ios-pink text-white text-xs font-semibold flex items-center justify-center space-x-1.5 shadow-sm hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
                >
                  <ArrowRightLeft className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                  <span>{isSyncing ? "正在云同步..." : "立即云对齐"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleLeaveRoom}
                  disabled={isLeaving}
                  className="px-3.5 py-2.5 rounded-2xl bg-ios-gray-5 dark:bg-ios-gray-dark4 text-ios-red text-xs font-semibold flex items-center justify-center space-x-1 hover:bg-ios-red/10 transition-all cursor-pointer disabled:opacity-50"
                  title="断开配对"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{isLeaving ? "退出中..." : "退出"}</span>
                </button>
              </div>

              <p className="text-[10px] text-ios-gray-2 leading-relaxed">
                「立即云对齐」= 手动把本机新记的账目上传云端，并拉取对方的新账目；应用打开时每
                15 秒也会自动对齐一次，切回应用瞬间同样自动对齐。{lastSyncLabel}
              </p>
            </div>
          ) : (
            /* Unpaired State */
            <div className="p-4 space-y-3.5">
              <div className="flex items-start space-x-3">
                <div className="w-9 h-9 rounded-2xl bg-ios-pink/10 text-ios-pink flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Users className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-black dark:text-white">
                    与另一半开启共享记账
                  </div>
                  <p className="text-xs text-ios-gray-1 mt-0.5 leading-relaxed">
                    各自记自己出的钱，双向同步后对方端会显示是谁出的，并自动按各付一半轧差结算。
                  </p>
                </div>
              </div>

              {syncStatusMsg && (
                <div className="text-xs text-ios-red bg-ios-red/10 px-3 py-1.5 rounded-xl text-center">
                  {syncStatusMsg}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCreateRoom}
                  disabled={isPairing}
                  className="py-2.5 rounded-2xl bg-ios-pink text-white text-xs font-semibold flex items-center justify-center space-x-1.5 shadow-sm hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
                >
                  <Heart className="w-3.5 h-3.5 fill-white" />
                  <span>{isPairing ? "生成中..." : "新建情侣账本"}</span>
                </button>

                <div className="flex space-x-1">
                  <input
                    type="text"
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                    placeholder="输入6位配对码"
                    maxLength={6}
                    className="flex-1 min-w-0 px-2.5 py-1.5 text-xs text-center uppercase tracking-widest font-mono bg-ios-gray-6 dark:bg-ios-gray-dark4 rounded-2xl border border-black/[0.04] dark:border-white/[0.06] text-black dark:text-white focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleJoinRoom}
                    disabled={isPairing || !inputCode.trim()}
                    className="px-3 py-1.5 rounded-2xl bg-ios-gray-5 dark:bg-ios-gray-dark3 text-ios-blue text-xs font-semibold hover:bg-ios-blue hover:text-white transition-all cursor-pointer disabled:opacity-40"
                  >
                    加入
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Group 1: Currency & Multi-Currency System */}
      <div className="space-y-2">
        <span className="text-xs font-bold text-ios-gray-1 uppercase tracking-wider px-2">
          全球多币种与汇率体系
        </span>

        <div className="bg-white dark:bg-[#1C1C1E] rounded-3xl overflow-hidden shadow-ios-card border border-black/[0.04] dark:border-white/[0.06] divide-y divide-black/[0.04] dark:divide-white/[0.04]">
          {/* Base Currency Selector */}
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-ios-blue/10 text-ios-blue flex items-center justify-center">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-black dark:text-white">
                    主基准币种 (Base Currency)
                  </div>
                  <p className="text-xs text-ios-gray-1">
                    用于全应用资产与统计的实时换算基准
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold font-mono px-2.5 py-1 rounded-lg bg-ios-gray-5 dark:bg-ios-gray-dark4 text-ios-blue">
                {baseCurrency}
              </span>
            </div>

            {/* Quick Currency Radio Badges */}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-1">
              {currencyList.map((curr) => {
                const isSelected = baseCurrency === curr.code;
                return (
                  <button
                    key={curr.code}
                    type="button"
                    onClick={() => handleCurrencySelect(curr.code)}
                    className={`flex items-center justify-between p-2 rounded-2xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? "bg-ios-blue text-white border-ios-blue shadow-sm"
                        : "bg-ios-gray-6 dark:bg-ios-gray-dark4 border-black/5 dark:border-white/5 text-black dark:text-white hover:bg-ios-gray-5"
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold font-mono">{curr.code}</div>
                      <div
                        className={`text-[10px] truncate max-w-[65px] ${
                          isSelected ? "text-white/80" : "text-ios-gray-1"
                        }`}
                      >
                        {curr.name}
                      </div>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Rates Cache & Live Refresh */}
          <div className="p-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-black dark:text-white">
                实时汇率缓存
              </div>
              <p className="text-xs text-ios-gray-1 mt-0.5">
                包含 {Object.keys(rates).length} 组外汇牌价 (离线即时计算)
              </p>
            </div>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-ios-gray-5 dark:bg-ios-gray-dark4 hover:bg-ios-gray-4 text-xs font-semibold text-ios-blue transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`}
              />
              <span>{refreshSuccess ? "已更新" : "更新汇率"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Group 2: Appearance & Preferences */}
      <div className="space-y-2">
        <span className="text-xs font-bold text-ios-gray-1 uppercase tracking-wider px-2">
          外观与触觉反馈
        </span>

        <div className="bg-white dark:bg-[#1C1C1E] rounded-3xl overflow-hidden shadow-ios-card border border-black/[0.04] dark:border-white/[0.06] divide-y divide-black/[0.04] dark:divide-white/[0.04]">
          {/* Theme Selector */}
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center">
                <Sun className="w-4 h-4" />
              </div>
              <span className="text-sm font-semibold text-black dark:text-white">
                外观模式
              </span>
            </div>

            <div className="flex bg-ios-gray-5 dark:bg-ios-gray-dark4 p-1 rounded-xl">
              {(["light", "dark", "system"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    haptics.selection();
                    onThemeChange(t);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                    theme === t
                      ? "bg-white dark:bg-ios-gray-dark2 text-black dark:text-white shadow-sm"
                      : "text-ios-gray-1 hover:text-black dark:hover:text-white"
                  }`}
                >
                  {t === "light" ? "浅色" : t === "dark" ? "深色" : "跟随系统"}
                </button>
              ))}
            </div>
          </div>

          {/* Sound & Haptics */}
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
                {soundEnabled ? (
                  <Volume2 className="w-4 h-4" />
                ) : (
                  <VolumeX className="w-4 h-4" />
                )}
              </div>
              <div>
                <div className="text-sm font-semibold text-black dark:text-white">
                  按键音效与振动反馈
                </div>
                <p className="text-xs text-ios-gray-1">
                  模拟 iOS Taptic Engine 震感与敲击按键音
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                haptics.selection();
                onToggleSound();
              }}
              className={`w-12 h-6.5 rounded-full transition-colors relative cursor-pointer ${
                soundEnabled ? "bg-emerald-500" : "bg-ios-gray-4 dark:bg-ios-gray-dark4"
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform absolute top-0.5 ${
                  soundEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Group 3: Data Management */}
      <div className="space-y-2">
        <span className="text-xs font-bold text-ios-gray-1 uppercase tracking-wider px-2">
          数据安全与备份
        </span>

        <div className="bg-white dark:bg-[#1C1C1E] rounded-3xl overflow-hidden shadow-ios-card border border-black/[0.04] dark:border-white/[0.06] divide-y divide-black/[0.04] dark:divide-white/[0.04]">
          {/* Export CSV */}
          <button
            type="button"
            disabled={isExporting}
            onClick={async () => {
              haptics.selection();
              setIsExporting(true);
              try {
                await onExportCSV();
                haptics.success();
                setExportSuccess(true);
                setTimeout(() => setExportSuccess(false), 3000);
              } catch (e) {
                haptics.error();
                console.error(e);
              } finally {
                setIsExporting(false);
              }
            }}
            className="w-full p-4 flex items-center justify-between hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors cursor-pointer text-left disabled:opacity-50"
          >
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <Download className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-semibold text-black dark:text-white flex items-center gap-2">
                  <span>导出账本 CSV</span>
                  {exportSuccess && (
                    <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      导出成功并已开始下载
                    </span>
                  )}
                </div>
                <p className="text-xs text-ios-gray-1">
                  将所有交易与流水导出为 Excel/Numbers 兼容表格
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-ios-gray-2" />
          </button>

          {/* Import CSV */}
          <label className="w-full p-4 flex items-center justify-between hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors cursor-pointer text-left">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                <Upload className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-semibold text-black dark:text-white">
                  导入 CSV 数据
                </div>
                <p className="text-xs text-ios-gray-1">
                  恢复之前导出的记账数据或第三方格式
                </p>
              </div>
            </div>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => {
                haptics.selection();
                onImportCSV(e);
              }}
              className="hidden"
            />
            <ChevronRight className="w-4 h-4 text-ios-gray-2" />
          </label>

          {/* Reset App Data */}
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center">
                <RotateCcw className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-semibold text-red-500">
                  一键重置账本数据
                </div>
                <p className="text-xs text-ios-gray-1">
                  清空所有记账流水并还原至初始演示数据
                </p>
              </div>
            </div>

            {showResetConfirm ? (
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={async () => {
                    haptics.heavy();
                    await onResetData();
                    setShowResetConfirm(false);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-red-500 text-white text-xs font-bold shadow-sm cursor-pointer"
                >
                  确定重置
                </button>
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(false)}
                  className="px-2.5 py-1.5 rounded-xl bg-ios-gray-5 dark:bg-ios-gray-dark4 text-xs text-ios-gray-1 cursor-pointer"
                >
                  取消
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="px-3 py-1.5 rounded-xl bg-red-500/10 text-red-500 text-xs font-semibold hover:bg-red-500/20 transition-colors cursor-pointer"
              >
                重置
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Group 4: About & Support */}
      <div className="space-y-2">
        <span className="text-xs font-bold text-ios-gray-1 uppercase tracking-wider px-2">
          关于与支持
        </span>

        <div className="bg-white dark:bg-[#1C1C1E] rounded-3xl overflow-hidden shadow-ios-card border border-black/[0.04] dark:border-white/[0.06] divide-y divide-black/[0.04] dark:divide-white/[0.04]">
          {/* Author */}
          <div className="p-4 flex items-center space-x-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-rose-500 to-purple-500 text-white flex items-center justify-center text-lg font-bold shadow-sm shrink-0">
              Z
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-black dark:text-white flex items-center gap-1.5">
                <span>{AUTHOR_NAME}</span>
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-rose-500/10 text-rose-500">
                  作者
                </span>
              </div>
              <p className="text-xs text-ios-gray-1">{AUTHOR_BIO}</p>
              <a
                href={`mailto:${AUTHOR_EMAIL}`}
                onClick={() => haptics.selection()}
                className="text-[11px] text-ios-blue inline-flex items-center gap-1 mt-0.5"
              >
                <Mail className="w-3 h-3" />
                {AUTHOR_EMAIL}
              </a>
            </div>
          </div>

          {/* GitHub Star */}
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            onClick={() => haptics.selection()}
            className="w-full p-4 flex items-center justify-between hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-xl bg-black/5 dark:bg-white/10 text-black dark:text-white flex items-center justify-center">
                <Code2 className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-semibold text-black dark:text-white flex items-center gap-1.5">
                  <span>给项目点个 Star</span>
                  <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                </div>
                <p className="text-xs text-ios-gray-1 truncate max-w-[200px]">
                  觉得好用就支持一下，issue 和 PR 也欢迎
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-ios-gray-2" />
          </a>

          {/* Donate */}
          <button
            type="button"
            onClick={() => {
              haptics.selection();
              setShowDonate((v) => !v);
            }}
            className="w-full p-4 flex items-center justify-between hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <Coffee className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-semibold text-black dark:text-white">
                  请作者喝杯奶茶 🧋
                </div>
                <p className="text-xs text-ios-gray-1">
                  如果这个 App 帮到了你，欢迎请我喝一杯
                </p>
              </div>
            </div>
            <ChevronRight
              className={`w-4 h-4 text-ios-gray-2 transition-transform ${showDonate ? "rotate-90" : ""}`}
            />
          </button>

          {showDonate && (
            <div className="p-4 bg-black/[0.02] dark:bg-white/[0.02] space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <figure className="space-y-1.5">
                  <a href="/donate-wechat.jpg" target="_blank" rel="noreferrer">
                    <img
                      src="/donate-wechat.jpg"
                      alt="微信收款码"
                      className="w-full rounded-2xl border border-black/5 dark:border-white/10"
                    />
                  </a>
                  <figcaption className="text-[11px] text-center text-ios-gray-1 font-medium">
                    微信支付
                  </figcaption>
                </figure>
                <figure className="space-y-1.5">
                  <a href="/donate-alipay.jpg" target="_blank" rel="noreferrer">
                    <img
                      src="/donate-alipay.jpg"
                      alt="支付宝收款码"
                      className="w-full rounded-2xl border border-black/5 dark:border-white/10"
                    />
                  </a>
                  <figcaption className="text-[11px] text-center text-ios-gray-1 font-medium">
                    支付宝
                  </figcaption>
                </figure>
              </div>
              <p className="text-[11px] text-center text-ios-gray-1">
                点码可放大，长按或截图即可扫码 · 金额随意，心意最重要 ❤️
              </p>
            </div>
          )}
        </div>
      </div>

      {/* App Info Card */}
      <div className="bg-white/50 dark:bg-[#1C1C1E]/50 rounded-3xl p-4 text-center space-y-1 border border-black/[0.02] dark:border-white/[0.04]">
        <div className="text-xs font-bold text-black dark:text-white">
          iOS HIG 极简多币种记账
        </div>
        <p className="text-[11px] text-ios-gray-1">
          Designed with SF Pro & iOS Fluid Glassmorphism
        </p>
        <p className="text-[11px] text-ios-gray-1">
          Crafted with <Heart className="w-3 h-3 text-rose-500 fill-rose-500 inline" /> by{" "}
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="text-ios-blue font-medium"
          >
            {AUTHOR_NAME}
          </a>{" "}
          in Hong Kong
        </p>
      </div>
    </div>
  );
};
