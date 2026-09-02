import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Trash2,
  ArrowDownLeft,
  ArrowUpRight,
  SlidersHorizontal,
  Heart,
  CheckCircle2,
} from "lucide-react";
import type { Transaction, Category, Account, LedgerId } from "../db";
import type { SharedSettlementSummary } from "../services/dataRepository";
import { syncService } from "../services/syncService";
import { CategoryIcon } from "./CategoryIcon";
import { formatCurrencyWithCode } from "../services/currency";
import { haptics } from "../lib/haptics";

interface TransactionsViewProps {
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  baseCurrency: string;
  currentLedger?: LedgerId;
  settlementSummary?: SharedSettlementSummary | null;
  onSettleDebt?: () => Promise<void>;
  onDeleteTransaction: (id: number) => Promise<void>;
  onOpenQuickAdd: (type?: "expense" | "income") => void;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  transactions,
  categories,
  accounts,
  baseCurrency,
  currentLedger = "personal",
  settlementSummary,
  onSettleDebt,
  onDeleteTransaction,
  onOpenQuickAdd,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "expense" | "income">("all");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("all");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const myNickname = syncService.getMyNickname();
  const partnerNickname = syncService.getPartnerNickname();

  const categoryMap = useMemo(() => {
    return new Map(categories.map((c) => [c.id, c]));
  }, [categories]);

  const accountMap = useMemo(() => {
    return new Map(accounts.map((a) => [a.id, a]));
  }, [accounts]);

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Type filter
      if (typeFilter !== "all" && tx.type !== typeFilter) {
        return false;
      }
      // Account filter
      if (selectedAccountId !== "all" && tx.accountId !== selectedAccountId) {
        return false;
      }
      // Category filter
      if (selectedCategoryId !== "all" && tx.categoryId !== selectedCategoryId) {
        return false;
      }
      // Search keyword filter (note, category name, amount)
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const catName = categoryMap.get(tx.categoryId)?.name?.toLowerCase() || "";
        const accName = accountMap.get(tx.accountId)?.name?.toLowerCase() || "";
        const note = (tx.note || "").toLowerCase();
        const amountStr = tx.amount.toString();
        const convStr = (tx.baseAmount || 0).toString();

        if (
          !catName.includes(term) &&
          !accName.includes(term) &&
          !note.includes(term) &&
          !amountStr.includes(term) &&
          !convStr.includes(term)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [transactions, typeFilter, selectedAccountId, selectedCategoryId, searchTerm, categoryMap, accountMap]);

  // Group transactions by date (descending)
  const groupedTransactions = useMemo(() => {
    const groups: { date: string; displayDate: string; items: Transaction[]; dayExpense: number; dayIncome: number }[] = [];
    
    const sorted = [...filteredTransactions].sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime() || b.createdAt - a.createdAt;
    });

    sorted.forEach((tx) => {
      const txDate = tx.date;
      let group = groups.find((g) => g.date === txDate);
      if (!group) {
        const d = new Date(txDate);
        const today = new Date().toISOString().split("T")[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

        let displayDate = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
        if (txDate === today) {
          displayDate = "今天";
        } else if (txDate === yesterday) {
          displayDate = "昨天";
        }

        const weekday = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][d.getDay()];
        displayDate = `${displayDate} · ${weekday}`;

        group = {
          date: txDate,
          displayDate,
          items: [],
          dayExpense: 0,
          dayIncome: 0,
        };
        groups.push(group);
      }

      group.items.push(tx);
      const amt = tx.baseAmount ?? tx.amount;
      if (tx.type === "expense") {
        group.dayExpense += amt;
      } else {
        group.dayIncome += amt;
      }
    });

    return groups;
  }, [filteredTransactions]);

  // Total summary of current filtered view
  const summary = useMemo(() => {
    let expense = 0;
    let income = 0;
    filteredTransactions.forEach((tx) => {
      const amt = tx.baseAmount ?? tx.amount;
      if (tx.type === "expense") expense += amt;
      else income += amt;
    });
    return { expense, income, balance: income - expense };
  }, [filteredTransactions]);

  const handleDelete = async (id: number | undefined) => {
    if (id === undefined) return;
    haptics.heavy();
    await onDeleteTransaction(id);
    setConfirmDeleteId(null);
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Shared Ledger Settlement Card (Only visible when currentLedger is shared) */}
      {currentLedger === "shared" && settlementSummary && (
        <div className="bg-gradient-to-br from-rose-500/10 via-pink-500/5 to-purple-500/10 dark:from-rose-500/20 dark:via-purple-500/10 dark:to-pink-500/20 p-4 rounded-3xl border border-rose-500/20 dark:border-rose-500/30 shadow-ios-card space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-sm">
                <Heart className="w-4 h-4 fill-white" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-black dark:text-white">恋爱账本 · 共同生活点滴</h2>
                <p className="text-[11px] text-ios-gray-1">两个人一起花了 {formatCurrencyWithCode(settlementSummary.totalSharedExpense, baseCurrency)}</p>
              </div>            </div>

            {onSettleDebt && settlementSummary.payerOwesWhom !== "settled" && (
              <button
                type="button"
                onClick={async () => {
                  haptics.success();
                  await onSettleDebt();
                }}
                className="px-3 py-1.5 rounded-full bg-gradient-to-r from-rose-500 to-pink-500 text-white text-xs font-semibold shadow-sm hover:brightness-105 active:scale-95 transition-all flex items-center space-x-1 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>爱意对齐 💫</span>
              </button>
            )}
          </div>

          {/* Breakdown Grid */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-white/70 dark:bg-[#1C1C1E]/70 p-2.5 rounded-2xl border border-black/[0.03] dark:border-white/[0.05]">
              <span className="text-ios-gray-1 text-[11px]">💗 {myNickname}出的</span>
              <p className="font-bold text-black dark:text-white font-mono text-sm mt-0.5">
                {formatCurrencyWithCode(settlementSummary.totalPaidByMe, baseCurrency)}
              </p>
            </div>
            <div className="bg-white/70 dark:bg-[#1C1C1E]/70 p-2.5 rounded-2xl border border-black/[0.03] dark:border-white/[0.05]">
              <span className="text-ios-gray-1 text-[11px]">💞 {partnerNickname}出的</span>
              <p className="font-bold text-black dark:text-white font-mono text-sm mt-0.5">
                {formatCurrencyWithCode(settlementSummary.totalPaidByPartner, baseCurrency)}
              </p>
            </div>
          </div>

          {/* Bottom Net Diff Conclusion Banner */}
          <div className="bg-white/90 dark:bg-[#1C1C1E]/90 px-3 py-2.5 rounded-2xl flex items-center justify-between text-xs border border-black/[0.04] dark:border-white/[0.06]">
            <div className="flex items-center space-x-1.5 text-ios-gray-1 shrink-0">
              <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
              <span>生活小默契：</span>
            </div>
            <span className="font-medium text-xs text-right">
              {settlementSummary.payerOwesWhom === "settled" ? (
                <span className="text-rose-500 font-semibold flex items-center space-x-1">
                  <span>心有灵犀，连账单都刚刚好 🥰</span>
                </span>
              ) : settlementSummary.payerOwesWhom === "partner_owes_me" ? (
                <span className="text-rose-500 font-semibold">
                  {partnerNickname}还差 {formatCurrencyWithCode(settlementSummary.owesAmount, baseCurrency)}，请杯奶茶就默契啦 🧋
                </span>
              ) : (
                <span className="text-pink-500 font-semibold">
                  你少付了 {formatCurrencyWithCode(settlementSummary.owesAmount, baseCurrency)}，快给{partnerNickname}甜甜补上 🎁
                </span>
              )}
            </span>
          </div>
        </div>
      )}

      {/* Top Header & Search Bar */}
      <div className="bg-white/80 dark:bg-[#1C1C1E]/80 backdrop-blur-md rounded-3xl p-4 shadow-ios-card border border-black/[0.04] dark:border-white/[0.06] space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-black dark:text-white tracking-tight">
              账目流水
            </h1>
            <p className="text-xs text-ios-gray-1 mt-0.5">
              共 {filteredTransactions.length} 笔记录
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => {
                haptics.selection();
                setShowFilters(!showFilters);
              }}
              className={`p-2 rounded-2xl border transition-all cursor-pointer ${
                showFilters || selectedAccountId !== "all" || selectedCategoryId !== "all"
                  ? "bg-ios-blue text-white border-ios-blue shadow-sm"
                  : "bg-ios-gray-6 dark:bg-ios-gray-dark4 text-black dark:text-white border-black/5 dark:border-white/5 hover:bg-ios-gray-5"
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search Input Box */}
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-ios-gray-1 absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="搜索备注、分类、账户或金额..."
            className="w-full pl-9 pr-8 py-2 rounded-2xl bg-ios-gray-5 dark:bg-ios-gray-dark4 text-xs sm:text-sm text-black dark:text-white outline-none border border-transparent focus:border-ios-blue transition-colors placeholder:text-ios-gray-2"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="absolute right-3 text-xs text-ios-gray-1 hover:text-black dark:hover:text-white"
            >
              ✕
            </button>
          )}
        </div>

        {/* Segmented Type Bar */}
        <div className="grid grid-cols-3 gap-1 bg-ios-gray-5 dark:bg-ios-gray-dark4 p-1 rounded-2xl">
          <button
            type="button"
            onClick={() => {
              haptics.selection();
              setTypeFilter("all");
            }}
            className={`py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              typeFilter === "all"
                ? "bg-white dark:bg-ios-gray-dark2 text-black dark:text-white shadow-sm"
                : "text-ios-gray-1 hover:text-black dark:hover:text-white"
            }`}
          >
            全部
          </button>
          <button
            type="button"
            onClick={() => {
              haptics.selection();
              setTypeFilter("expense");
            }}
            className={`py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              typeFilter === "expense"
                ? "bg-white dark:bg-ios-gray-dark2 text-red-500 shadow-sm"
                : "text-ios-gray-1 hover:text-black dark:hover:text-white"
            }`}
          >
            支出
          </button>
          <button
            type="button"
            onClick={() => {
              haptics.selection();
              setTypeFilter("income");
            }}
            className={`py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              typeFilter === "income"
                ? "bg-white dark:bg-ios-gray-dark2 text-emerald-500 shadow-sm"
                : "text-ios-gray-1 hover:text-black dark:hover:text-white"
            }`}
          >
            收入
          </button>
        </div>

        {/* Collapsible Filter Dropdowns */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden pt-2 border-t border-black/[0.04] dark:border-white/[0.04] grid grid-cols-2 gap-2"
            >
              <div>
                <label className="text-[10px] font-bold text-ios-gray-1 uppercase tracking-wider block mb-1">
                  账户筛选
                </label>
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="w-full bg-ios-gray-5 dark:bg-ios-gray-dark4 text-black dark:text-white text-xs p-2 rounded-xl outline-none border border-transparent focus:border-ios-blue cursor-pointer"
                >
                  <option value="all">所有账户</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.currency})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-ios-gray-1 uppercase tracking-wider block mb-1">
                  分类筛选
                </label>
                <select
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  className="w-full bg-ios-gray-5 dark:bg-ios-gray-dark4 text-black dark:text-white text-xs p-2 rounded-xl outline-none border border-transparent focus:border-ios-blue cursor-pointer"
                >
                  <option value="all">所有分类</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name} ({cat.type === "expense" ? "支出" : "收入"})
                    </option>
                  ))}
                </select>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Overview Stat Strip */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white dark:bg-[#1C1C1E] p-3 rounded-2xl shadow-sm border border-black/[0.03] dark:border-white/[0.05]">
          <div className="flex items-center space-x-1.5 text-ios-gray-1 text-xs">
            <ArrowDownLeft className="w-3.5 h-3.5 text-red-500" />
            <span>筛选支出</span>
          </div>
          <div className="text-base sm:text-lg font-bold text-red-500 mt-1 font-mono">
            {formatCurrencyWithCode(summary.expense, baseCurrency)}
          </div>
        </div>

        <div className="bg-white dark:bg-[#1C1C1E] p-3 rounded-2xl shadow-sm border border-black/[0.03] dark:border-white/[0.05]">
          <div className="flex items-center space-x-1.5 text-ios-gray-1 text-xs">
            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
            <span>筛选收入</span>
          </div>
          <div className="text-base sm:text-lg font-bold text-emerald-500 mt-1 font-mono">
            {formatCurrencyWithCode(summary.income, baseCurrency)}
          </div>
        </div>
      </div>

      {/* Date Grouped Transaction Stream */}
      {groupedTransactions.length === 0 ? (
        <div className="bg-white/50 dark:bg-ios-gray-dark3/50 rounded-3xl p-8 text-center border border-dashed border-black/10 dark:border-white/10 my-6">
          <p className="text-sm font-semibold text-ios-gray-1">暂无相关流水记录</p>
          <p className="text-xs text-ios-gray-2 mt-1">
            点击下方记账按钮快速记录一笔收支
          </p>
          <button
            type="button"
            onClick={() => onOpenQuickAdd("expense")}
            className="mt-4 px-4 py-2 rounded-full bg-ios-blue text-white text-xs font-semibold shadow-sm hover:brightness-105 active:scale-95 transition-all cursor-pointer"
          >
            立即记一笔
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedTransactions.map((group) => (
            <div key={group.date} className="space-y-1.5">
              {/* Date Header Strip */}
              <div className="flex items-center justify-between px-2 text-xs text-ios-gray-1">
                <span className="font-semibold">{group.displayDate}</span>
                <div className="flex items-center space-x-2 font-mono text-[11px]">
                  {group.dayExpense > 0 && (
                    <span>支: {formatCurrencyWithCode(group.dayExpense, baseCurrency)}</span>
                  )}
                  {group.dayIncome > 0 && (
                    <span className="text-emerald-500">
                      收: {formatCurrencyWithCode(group.dayIncome, baseCurrency)}
                    </span>
                  )}
                </div>
              </div>

              {/* Transactions in this date */}
              <div className="bg-white dark:bg-[#1C1C1E] rounded-3xl overflow-hidden shadow-ios-card border border-black/[0.04] dark:border-white/[0.06] divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                {group.items.map((tx) => {
                  const cat = categoryMap.get(tx.categoryId);
                  const acc = accountMap.get(tx.accountId);
                  const isMultiCurrency = tx.currency !== baseCurrency;

                  return (
                    <div
                      key={tx.id}
                      className="p-3.5 flex items-center justify-between hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors group"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        {/* Icon */}
                        <div
                          className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm"
                          style={{
                            backgroundColor: cat ? `${cat.color}15` : "#F2F2F7",
                            color: cat ? cat.color : "#8E8E93",
                          }}
                        >
                          <CategoryIcon name={cat?.icon || "MoreHorizontal"} size={18} />
                        </div>

                        {/* Title & Details */}
                        <div className="min-w-0">
                          <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                            <span className="text-sm font-semibold text-black dark:text-white truncate">
                              {cat?.name || "未知分类"}
                            </span>
                            {acc && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-ios-gray-5 dark:bg-ios-gray-dark4 text-ios-gray-1 shrink-0 font-medium">
                                {acc.name}
                              </span>
                            )}
                            {/* Shared Ledger Ownership Badge: who recorded it paid it */}
                            {tx.ledgerId === "shared" && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium shrink-0 ${
                                syncService.isMine(tx)
                                  ? "bg-rose-500/10 text-rose-500 dark:bg-rose-500/20"
                                  : "bg-purple-500/10 text-purple-500 dark:bg-purple-500/20"
                              }`}>
                                {syncService.isMine(tx) ? `${myNickname}出的` : `${partnerNickname}出的`}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-ios-gray-1 truncate mt-0.5">
                            {tx.note || (tx.type === "expense" ? "日常支出" : "收入所得")}
                          </p>
                        </div>
                      </div>

                      {/* Right Amount & Actions */}
                      <div className="flex items-center space-x-2 shrink-0 ml-3">
                        <div className="text-right">
                          {/* Original Transaction Amount */}
                          <div
                            className={`text-sm sm:text-base font-bold font-mono ${
                              tx.type === "expense"
                                ? "text-black dark:text-white"
                                : "text-emerald-500 dark:text-emerald-400"
                            }`}
                          >
                            {tx.type === "expense" ? "-" : "+"}
                            {formatCurrencyWithCode(tx.amount, tx.currency)}
                          </div>

                          {/* Converted Base Currency Preview if multi-currency */}
                          {isMultiCurrency && tx.baseAmount !== undefined && (
                            <div className="text-[10px] text-ios-gray-1 font-mono">
                              ≈ {formatCurrencyWithCode(tx.baseAmount, baseCurrency)}
                            </div>
                          )}
                        </div>

                        {/* Delete Button */}
                        {confirmDeleteId === tx.id ? (
                          <div className="flex items-center space-x-1 pl-1">
                            <button
                              type="button"
                              onClick={() => handleDelete(tx.id)}
                              className="px-2 py-1 rounded-lg bg-red-500 text-white text-[11px] font-bold shadow-sm cursor-pointer"
                            >
                              确认
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 rounded-lg bg-ios-gray-5 dark:bg-ios-gray-dark4 text-xs text-ios-gray-1 cursor-pointer"
                            >
                              取消
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(tx.id ?? null)}
                            className="p-1.5 rounded-xl text-ios-gray-2 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                            title="删除账目"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
