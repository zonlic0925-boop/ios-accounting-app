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
} from "lucide-react";
import { getAllCurrencies } from "../services/currency";
import { haptics } from "../lib/haptics";

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
  const currencyList = getAllCurrencies();

  return (
    <div className="space-y-5 pb-20">
      {/* Title */}
      <div className="px-1">
        <h1 className="text-xl font-bold text-black dark:text-white">系统设置</h1>
        <p className="text-xs text-ios-gray-1 mt-0.5">
          偏好设置、多币种折算基准与数据备份管理
        </p>
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

      {/* App Info Card */}
      <div className="bg-white/50 dark:bg-[#1C1C1E]/50 rounded-3xl p-4 text-center space-y-1 border border-black/[0.02] dark:border-white/[0.04]">
        <div className="text-xs font-bold text-black dark:text-white">
          iOS HIG 极简多币种记账
        </div>
        <p className="text-[11px] text-ios-gray-1">
          Designed with SF Pro & iOS Fluid Glassmorphism
        </p>
      </div>
    </div>
  );
};
