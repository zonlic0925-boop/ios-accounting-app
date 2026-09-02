import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  Calendar,
  PieChart as PieChartIcon,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";
import type { Transaction, Category, LedgerId } from "../db";
import { CategoryIcon } from "./CategoryIcon";
import { formatCurrencyWithCode } from "../services/currency";
import { syncService } from "../services/syncService";
import { haptics } from "../lib/haptics";

interface AnalyticsViewProps {
  transactions: Transaction[];
  categories: Category[];
  baseCurrency: string;
  /** Which ledger the passed transactions belong to; shared enables the per-partner breakdown. */
  ledgerId?: LedgerId;
}

type TimeDimension = "week" | "month" | "year";

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  transactions,
  categories,
  baseCurrency,
  ledgerId,
}) => {
  const [dimension, setDimension] = useState<TimeDimension>("month");
  const [activeType, setActiveType] = useState<"expense" | "income">("expense");
  const [offset, setOffset] = useState<number>(0); // 0 = current period, -1 = last period, etc.

  const categoryMap = useMemo(() => {
    return new Map(categories.map((c) => [c.id, c]));
  }, [categories]);

  // Determine current period date range based on dimension & offset
  const { startDate, endDate, label } = useMemo(() => {
    const now = new Date();
    if (dimension === "week") {
      const d = new Date(now);
      // adjust to start of week (Monday)
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1) + offset * 7;
      const start = new Date(d.setDate(diff));
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);

      const label = `${start.getMonth() + 1}月${start.getDate()}日 - ${end.getMonth() + 1}月${end.getDate()}日`;
      return { startDate: start, endDate: end, label };
    } else if (dimension === "month") {
      const targetDate = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const year = targetDate.getFullYear();
      const month = targetDate.getMonth();
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
      const label = `${year}年${month + 1}月`;
      return { startDate: start, endDate: end, label };
    } else {
      const year = now.getFullYear() + offset;
      const start = new Date(year, 0, 1);
      const end = new Date(year, 11, 31, 23, 59, 59, 999);
      const label = `${year}年`;
      return { startDate: start, endDate: end, label };
    }
  }, [dimension, offset]);

  // Filter transactions inside the selected period
  const periodTransactions = useMemo(() => {
    const startStr = startDate.toISOString().split("T")[0];
    const endStr = endDate.toISOString().split("T")[0];

    return transactions.filter((tx) => {
      return tx.date >= startStr && tx.date <= endStr;
    });
  }, [transactions, startDate, endDate]);

  // Calculate totals
  const { totalExpense, totalIncome, netSavings } = useMemo(() => {
    let exp = 0;
    let inc = 0;
    periodTransactions.forEach((tx) => {
      const amt = tx.baseAmount !== undefined ? tx.baseAmount : tx.amount;
      if (tx.type === "expense") exp += amt;
      else inc += amt;
    });
    const net = inc - exp;
    return { totalExpense: exp, totalIncome: inc, netSavings: net };
  }, [periodTransactions]);

  // Filter transactions by active tab (expense/income) for charts
  const chartTransactions = useMemo(() => {
    return periodTransactions.filter((tx) => tx.type === activeType);
  }, [periodTransactions, activeType]);

  const activeTotal = activeType === "expense" ? totalExpense : totalIncome;

  // Shared ledger: how much each partner paid in this period (expenses only;
  // recording equals paying, same ownership model as the settlement engine).
  const isSharedLedger = ledgerId === "shared";
  const partnerStats = useMemo(() => {
    const myNickname = syncService.getMyNickname();
    const partnerNickname = syncService.getPartnerNickname();
    let mine = 0;
    let partner = 0;
    let myCount = 0;
    let partnerCount = 0;
    periodTransactions.forEach((tx) => {
      if (tx.type !== "expense") return;
      const amt = tx.baseAmount !== undefined ? tx.baseAmount : tx.amount;
      if (syncService.isMine(tx)) {
        mine += amt;
        myCount += 1;
      } else {
        partner += amt;
        partnerCount += 1;
      }
    });
    const total = mine + partner;
    return {
      myNickname,
      partnerNickname,
      mine,
      partner,
      myCount,
      partnerCount,
      total,
      myPct: total > 0 ? (mine / total) * 100 : 0,
      partnerPct: total > 0 ? (partner / total) * 100 : 0,
    };
  }, [periodTransactions]);

  // Category Breakdown
  const categoryStats = useMemo(() => {
    const group: Record<string, { categoryId: string; total: number; count: number }> = {};
    chartTransactions.forEach((tx) => {
      const amt = tx.baseAmount !== undefined ? tx.baseAmount : tx.amount;
      if (!group[tx.categoryId]) {
        group[tx.categoryId] = { categoryId: tx.categoryId, total: 0, count: 0 };
      }
      group[tx.categoryId].total += amt;
      group[tx.categoryId].count += 1;
    });

    const list = Object.values(group).map((item) => {
      const cat = categoryMap.get(item.categoryId);
      const percentage = activeTotal > 0 ? (item.total / activeTotal) * 100 : 0;
      return {
        ...item,
        name: cat?.name || "未知分类",
        color: cat?.color || "#8E8E93",
        icon: cat?.icon || "MoreHorizontal",
        percentage,
      };
    });

    return list.sort((a, b) => b.total - a.total);
  }, [chartTransactions, categoryMap, activeTotal]);

  // Time Series Trend Data for SVG Bezier Chart
  const trendData = useMemo(() => {
    if (dimension === "week") {
      const days = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
      const dayValues = [0, 0, 0, 0, 0, 0, 0];
      const startTimestamp = startDate.getTime();

      chartTransactions.forEach((tx) => {
        const txTime = new Date(tx.date).getTime();
        const diffDays = Math.floor((txTime - startTimestamp) / 86400000);
        if (diffDays >= 0 && diffDays < 7) {
          const amt = tx.baseAmount !== undefined ? tx.baseAmount : tx.amount;
          dayValues[diffDays] += amt;
        }
      });

      return days.map((dayName, idx) => ({ label: dayName, value: dayValues[idx] }));
    } else if (dimension === "month") {
      // Group by 4 periods or each week in the month
      const daysInMonth = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0).getDate();
      const points: Array<{ label: string; startDay: number; endDay: number; value: number }> = [];
      const step = Math.ceil(daysInMonth / 6); // ~6 data points
      for (let i = 1; i <= daysInMonth; i += step) {
        points.push({ label: `${i}日`, startDay: i, endDay: Math.min(i + step - 1, daysInMonth), value: 0 });
      }

      chartTransactions.forEach((tx) => {
        const day = new Date(tx.date).getDate();
        const amt = tx.baseAmount !== undefined ? tx.baseAmount : tx.amount;
        const bucket = points.find((p) => day >= p.startDay && day <= p.endDay);
        if (bucket) {
          bucket.value += amt;
        }
      });

      return points.map((p) => ({ label: p.label, value: p.value }));
    } else {
      // Year: 12 months
      const months = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
      const monthValues = new Array(12).fill(0);
      chartTransactions.forEach((tx) => {
        const m = new Date(tx.date).getMonth();
        const amt = tx.baseAmount !== undefined ? tx.baseAmount : tx.amount;
        monthValues[m] += amt;
      });

      return months.map((mName, idx) => ({ label: mName, value: monthValues[idx] }));
    }
  }, [dimension, startDate, chartTransactions]);

  // Generate SVG smooth Bezier curve path
  const svgPath = useMemo(() => {
    if (trendData.length < 2) return { path: "", areaPath: "", points: [] };

    const width = 320;
    const height = 120;
    const padding = 20;
    const maxVal = Math.max(...trendData.map((d) => d.value), 1);

    const pts = trendData.map((d, index) => {
      const x = padding + (index / (trendData.length - 1)) * (width - 2 * padding);
      const y = height - padding - (d.value / maxVal) * (height - 2 * padding);
      return { x, y, value: d.value, label: d.label };
    });

    // Catmull-Rom or cubic Bezier spline
    let path = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i === 0 ? 0 : i - 1];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2 >= pts.length ? i + 1 : i + 2];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }

    const areaPath = `${path} L ${pts[pts.length - 1].x} ${height} L ${pts[0].x} ${height} Z`;

    return { path, areaPath, points: pts };
  }, [trendData]);

  // SVG Ring Chart calculation
  const ringSlices = useMemo(() => {
    if (categoryStats.length === 0 || activeTotal === 0) return [];
    let accumulatedAngle = 0;
    const radius = 40;
    const circumference = 2 * Math.PI * radius;

    return categoryStats.slice(0, 6).map((cat) => {
      const ratio = cat.total / activeTotal;
      const strokeDasharray = `${ratio * circumference} ${circumference}`;
      const strokeDashoffset = -accumulatedAngle * circumference;
      accumulatedAngle += ratio;
      return {
        ...cat,
        strokeDasharray,
        strokeDashoffset,
      };
    });
  }, [categoryStats, activeTotal]);

  return (
    <div className="space-y-4 pb-20">
      {/* Header with Dimension Filter and Period Navigator */}
      <div className="bg-white/80 dark:bg-[#1C1C1E]/80 backdrop-blur-md rounded-3xl p-4 shadow-ios-card border border-black/[0.04] dark:border-white/[0.06] space-y-3">
        {/* Time Dimension Segmented Control */}
        <div className="grid grid-cols-3 gap-1 bg-ios-gray-5 dark:bg-ios-gray-dark4 p-1 rounded-2xl">
          {(["week", "month", "year"] as TimeDimension[]).map((dim) => (
            <button
              key={dim}
              type="button"
              onClick={() => {
                haptics.selection();
                setDimension(dim);
                setOffset(0);
              }}
              className={`py-1.5 rounded-xl text-xs font-semibold transition-all capitalize cursor-pointer ${
                dimension === dim
                  ? "bg-white dark:bg-ios-gray-dark2 text-black dark:text-white shadow-sm"
                  : "text-ios-gray-1 hover:text-black dark:hover:text-white"
              }`}
            >
              {dim === "week" ? "按周" : dim === "month" ? "按月" : "按年"}
            </button>
          ))}
        </div>

        {/* Period Navigator */}
        <div className="flex items-center justify-between px-2 pt-1">
          <button
            type="button"
            onClick={() => {
              haptics.selection();
              setOffset((prev) => prev - 1);
            }}
            className="w-8 h-8 rounded-full bg-ios-gray-5 dark:bg-ios-gray-dark4 flex items-center justify-center text-ios-gray-1 hover:text-black dark:hover:text-white cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="text-center">
            <h2 className="text-sm sm:text-base font-bold text-black dark:text-white flex items-center justify-center space-x-1">
              <Calendar className="w-3.5 h-3.5 text-ios-blue inline mr-1" />
              <span>{label}</span>
            </h2>
            {offset !== 0 && (
              <button
                type="button"
                onClick={() => setOffset(0)}
                className="text-[10px] text-ios-blue hover:underline font-semibold mt-0.5"
              >
                回到当期
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              haptics.selection();
              setOffset((prev) => prev + 1);
            }}
            className="w-8 h-8 rounded-full bg-ios-gray-5 dark:bg-ios-gray-dark4 flex items-center justify-center text-ios-gray-1 hover:text-black dark:hover:text-white cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Income & Expense Overview Strip */}
      <div className="grid grid-cols-2 gap-3">
        <div
          onClick={() => {
            haptics.selection();
            setActiveType("expense");
          }}
          className={`p-4 rounded-3xl border transition-all cursor-pointer ${
            activeType === "expense"
              ? "bg-red-500/10 border-red-500/30 dark:bg-red-500/15"
              : "bg-white dark:bg-[#1C1C1E] border-black/[0.03] dark:border-white/[0.05]"
          }`}
        >
          <div className="flex items-center space-x-1.5 text-xs text-red-500 font-semibold">
            <ArrowDownLeft className="w-4 h-4" />
            <span>总支出</span>
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-red-500 mt-1">
            {formatCurrencyWithCode(totalExpense, baseCurrency)}
          </div>
          <p className="text-[11px] text-ios-gray-1 mt-0.5">
            共 {periodTransactions.filter((t) => t.type === "expense").length} 笔支出
          </p>
        </div>

        <div
          onClick={() => {
            haptics.selection();
            setActiveType("income");
          }}
          className={`p-4 rounded-3xl border transition-all cursor-pointer ${
            activeType === "income"
              ? "bg-emerald-500/10 border-emerald-500/30 dark:bg-emerald-500/15"
              : "bg-white dark:bg-[#1C1C1E] border-black/[0.03] dark:border-white/[0.05]"
          }`}
        >
          <div className="flex items-center space-x-1.5 text-xs text-emerald-500 font-semibold">
            <ArrowUpRight className="w-4 h-4" />
            <span>总收入</span>
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-emerald-500 mt-1">
            {formatCurrencyWithCode(totalIncome, baseCurrency)}
          </div>
          <p className="text-[11px] text-ios-gray-1 mt-0.5">
            结余: {formatCurrencyWithCode(netSavings, baseCurrency)}
          </p>
        </div>
      </div>

      {/* Shared Ledger: Per-Partner Spending Breakdown */}
      {isSharedLedger && (
        <div className="bg-gradient-to-br from-rose-500/10 via-pink-500/5 to-purple-500/10 dark:from-rose-500/20 dark:via-purple-500/10 dark:to-pink-500/20 rounded-3xl p-4 shadow-ios-card border border-rose-500/20 dark:border-rose-500/30 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5">
              <span className="text-sm">💗💞</span>
              <h3 className="text-xs sm:text-sm font-bold text-black dark:text-white">双方出账对比</h3>
            </div>
            <span className="text-[11px] text-ios-gray-1 font-mono">
              共同支出 {formatCurrencyWithCode(partnerStats.total, baseCurrency)}
            </span>
          </div>

          {/* Two-segment share bar: rose = mine, purple = partner's (same colors as the ownership badges) */}
          <div className="flex h-2.5 rounded-full overflow-hidden bg-white/60 dark:bg-white/10">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${partnerStats.myPct}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="h-full bg-rose-500"
            />
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${partnerStats.partnerPct}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="h-full bg-purple-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-white/70 dark:bg-[#1C1C1E]/70 p-2.5 rounded-2xl border border-black/[0.03] dark:border-white/[0.05]">
              <span className="text-ios-gray-1 text-[11px]">💗 {partnerStats.myNickname}出的</span>
              <p className="font-bold text-rose-500 font-mono text-sm mt-0.5">
                {formatCurrencyWithCode(partnerStats.mine, baseCurrency)}
              </p>
              <p className="text-[10px] text-ios-gray-1 mt-0.5">
                占 {partnerStats.myPct.toFixed(1)}% · {partnerStats.myCount} 笔
              </p>
            </div>
            <div className="bg-white/70 dark:bg-[#1C1C1E]/70 p-2.5 rounded-2xl border border-black/[0.03] dark:border-white/[0.05]">
              <span className="text-ios-gray-1 text-[11px]">💞 {partnerStats.partnerNickname}出的</span>
              <p className="font-bold text-purple-500 font-mono text-sm mt-0.5">
                {formatCurrencyWithCode(partnerStats.partner, baseCurrency)}
              </p>
              <p className="text-[10px] text-ios-gray-1 mt-0.5">
                占 {partnerStats.partnerPct.toFixed(1)}% · {partnerStats.partnerCount} 笔
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Smooth Bezier Trend Chart Card */}
      <div className="bg-white dark:bg-[#1C1C1E] rounded-3xl p-4 sm:p-5 shadow-ios-card border border-black/[0.04] dark:border-white/[0.06] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <TrendingUp
              className={`w-4 h-4 ${
                activeType === "expense" ? "text-red-500" : "text-emerald-500"
              }`}
            />
            <h3 className="text-xs sm:text-sm font-bold text-black dark:text-white">
              {activeType === "expense" ? "支出" : "收入"}趋势曲线
            </h3>
          </div>
          <span className="text-xs text-ios-gray-1 font-mono">
            最高峰:{" "}
            {formatCurrencyWithCode(
              Math.max(...trendData.map((d) => d.value), 0),
              baseCurrency
            )}
          </span>
        </div>

        {/* SVG Curve Chart */}
        <div className="w-full h-36 relative flex items-center justify-center pt-2">
          {activeTotal > 0 ? (
            <svg
              viewBox="0 0 320 120"
              className="w-full h-full overflow-visible"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor={activeType === "expense" ? "#FF3B30" : "#34C759"}
                    stopOpacity="0.3"
                  />
                  <stop
                    offset="100%"
                    stopColor={activeType === "expense" ? "#FF3B30" : "#34C759"}
                    stopOpacity="0.0"
                  />
                </linearGradient>
              </defs>

              {/* Area fill */}
              {svgPath.areaPath && (
                <path d={svgPath.areaPath} fill="url(#curveGradient)" />
              )}

              {/* Stroke line */}
              {svgPath.path && (
                <path
                  d={svgPath.path}
                  fill="none"
                  stroke={activeType === "expense" ? "#FF3B30" : "#34C759"}
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              )}

              {/* Data points */}
              {svgPath.points.map((p, idx) => (
                <g key={idx}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="4"
                    className="fill-white dark:fill-ios-gray-dark"
                    stroke={activeType === "expense" ? "#FF3B30" : "#34C759"}
                    strokeWidth="2.5"
                  />
                </g>
              ))}
            </svg>
          ) : (
            <div className="text-xs text-ios-gray-1">本期暂无{activeType === "expense" ? "支出" : "收入"}走势</div>
          )}
        </div>

        {/* X-Axis Labels */}
        <div className="flex justify-between px-2 text-[10px] text-ios-gray-1 font-mono">
          {trendData.map((d, i) => (
            <span key={i}>{d.label}</span>
          ))}
        </div>
      </div>

      {/* Category Breakdown & Ring Chart */}
      <div className="bg-white dark:bg-[#1C1C1E] rounded-3xl p-4 sm:p-5 shadow-ios-card border border-black/[0.04] dark:border-white/[0.06] space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <PieChartIcon className="w-4 h-4 text-ios-blue" />
            <h3 className="text-xs sm:text-sm font-bold text-black dark:text-white">
              {activeType === "expense" ? "支出" : "收入"}分类占比
            </h3>
          </div>
          <span className="text-xs text-ios-gray-1">
            共 {categoryStats.length} 个分类
          </span>
        </div>

        {categoryStats.length > 0 ? (
          <div className="flex flex-col sm:flex-row items-center sm:space-x-6 space-y-4 sm:space-y-0">
            {/* SVG Ring Donut */}
            <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke="currentColor"
                  className="text-ios-gray-5 dark:text-ios-gray-dark4"
                  strokeWidth="12"
                />
                {ringSlices.map((slice) => (
                  <circle
                    key={slice.categoryId}
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke={slice.color}
                    strokeWidth="12"
                    strokeDasharray={slice.strokeDasharray}
                    strokeDashoffset={slice.strokeDashoffset}
                    strokeLinecap="round"
                    className="transition-all duration-500 ease-out"
                  />
                ))}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                <span className="text-[10px] text-ios-gray-1">首位占比</span>
                <span className="text-xs font-bold font-mono text-black dark:text-white">
                  {categoryStats[0]?.percentage.toFixed(0)}%
                </span>
              </div>
            </div>

            {/* Category Ranking List */}
            <div className="w-full space-y-2.5">
              {categoryStats.map((item) => (
                <div key={item.categoryId} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${item.color}20`, color: item.color }}
                      >
                        <CategoryIcon name={item.icon} size={12} />
                      </div>
                      <span className="font-medium text-black dark:text-white truncate max-w-[100px] sm:max-w-[140px]">
                        {item.name}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 font-mono">
                      <span className="text-ios-gray-1 text-[11px]">
                        {item.percentage.toFixed(1)}%
                      </span>
                      <span className="font-semibold text-black dark:text-white">
                        {formatCurrencyWithCode(item.total, baseCurrency)}
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-1.5 rounded-full bg-ios-gray-5 dark:bg-ios-gray-dark4 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${item.percentage}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-ios-gray-1">
            本周期内暂无{activeType === "expense" ? "支出" : "收入"}记录
          </div>
        )}
      </div>
    </div>
  );
};
