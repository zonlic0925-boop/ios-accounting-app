import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet,
  CreditCard,
  Building2,
  Coins,
  ArrowRightLeft,
  Plus,
  Edit2,
  ShieldCheck,
  X,
} from "lucide-react";
import type { Account } from "../db";
import { TransferModal } from "./TransferModal";
import { useModalBackClose } from "../hooks/useModalBackClose";
import {
  convertAmount,
  formatCurrencyWithCode,
  getAllCurrencies,
} from "../services/currency";
import { haptics } from "../lib/haptics";

interface AccountsViewProps {
  accounts: Account[];
  rates: Record<string, number>;
  baseCurrency: string;
  onAddAccount: (account: Omit<Account, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  onUpdateAccount: (id: string, updates: Partial<Account>) => Promise<void>;
  onDeleteAccount: (id: string) => Promise<void>;
  onTransfer: (data: {
    fromAccountId: string;
    toAccountId: string;
    fromAmount: number;
    toAmount: number;
    date: string;
    note?: string;
  }) => Promise<void>;
}

export const AccountsView: React.FC<AccountsViewProps> = ({
  accounts,
  rates,
  baseCurrency,
  onAddAccount,
  onUpdateAccount,
  onDeleteAccount,
  onTransfer,
}) => {
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  // Android system back closes the inline add/edit modal instead of exiting
  // (TransferModal handles its own back guard internally)
  useModalBackClose(isAddAccountOpen, () => setIsAddAccountOpen(false));

  // New / Edit Account form state
  const [name, setName] = useState("");
  const [type, setType] = useState<Account["type"]>("cash");
  const [currency, setCurrency] = useState(baseCurrency);
  const [balance, setBalance] = useState<string>("0");
  const [color, setColor] = useState("#007AFF");
  const [isDefault, setIsDefault] = useState(false);

  // Calculate Net Worth converted to baseCurrency
  const { totalNetWorth, totalAssets, totalLiabilities } = useMemo(() => {
    let assets = 0;
    let liabilities = 0;

    accounts.forEach((acc) => {
      const converted = convertAmount(acc.balance, acc.currency, baseCurrency, rates);
      if (converted >= 0) {
        assets += converted;
      } else {
        liabilities += Math.abs(converted);
      }
    });

    return {
      totalNetWorth: assets - liabilities,
      totalAssets: assets,
      totalLiabilities: liabilities,
    };
  }, [accounts, baseCurrency, rates]);

  // Group accounts by type
  const groupedAccounts = useMemo(() => {
    const groups: { type: Account["type"]; label: string; icon: React.ComponentType<{ className?: string }>; items: Account[] }[] = [
      { type: "cash", label: "现金账户", icon: Wallet, items: [] },
      { type: "debit", label: "储蓄卡 / 银行账户", icon: Building2, items: [] },
      { type: "credit", label: "信用卡 / 信用负债", icon: CreditCard, items: [] },
      { type: "other", label: "多币种及其他账户", icon: Coins, items: [] },
    ];

    accounts.forEach((acc) => {
      const g = groups.find((grp) => grp.type === acc.type) || groups[3];
      g.items.push(acc);
    });

    return groups.filter((g) => g.items.length > 0);
  }, [accounts]);

  const openAddModal = () => {
    haptics.selection();
    setName("");
    setType("cash");
    setCurrency(baseCurrency);
    setBalance("0");
    setColor("#007AFF");
    setIsDefault(false);
    setEditingAccount(null);
    setIsAddAccountOpen(true);
  };

  const openEditModal = (acc: Account) => {
    haptics.selection();
    setName(acc.name);
    setType(acc.type);
    setCurrency(acc.currency);
    setBalance(acc.balance.toString());
    setColor(acc.color || "#007AFF");
    setIsDefault(!!acc.isDefault);
    setEditingAccount(acc);
    setIsAddAccountOpen(true);
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const numBalance = parseFloat(balance) || 0;

    if (editingAccount) {
      await onUpdateAccount(editingAccount.id, {
        name: name.trim(),
        type,
        currency,
        balance: numBalance,
        color,
        icon: type === "debit" ? "Building2" : type === "credit" ? "CreditCard" : "Wallet",
        isDefault,
      });
    } else {
      await onAddAccount({
        name: name.trim(),
        type,
        currency,
        balance: numBalance,
        color,
        icon: type === "debit" ? "Building2" : type === "credit" ? "CreditCard" : "Wallet",
        isDefault,
      });
    }

    setIsAddAccountOpen(false);
    setEditingAccount(null);
  };

  return (
    <div className="space-y-5 pb-20">
      {/* iOS Liquid Glass Net Worth Card */}
      <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-ios-blue via-indigo-600 to-purple-600 p-6 text-white shadow-xl shadow-ios-blue/20">
        {/* Ambient Glows */}
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-white/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-purple-400/20 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 opacity-80" />
              <span className="text-xs font-semibold uppercase tracking-wider opacity-80">
                折算总净资产 ({baseCurrency})
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                haptics.selection();
                setIsTransferOpen(true);
              }}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md text-xs font-semibold transition-all active:scale-95 cursor-pointer shadow-sm"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>跨账户互转</span>
            </button>
          </div>

          <div>
            <div className="text-3xl sm:text-4xl font-extrabold font-mono tracking-tight">
              {formatCurrencyWithCode(totalNetWorth, baseCurrency)}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-3 border-t border-white/15 text-xs">
            <div>
              <span className="opacity-75 block text-[11px]">总资产</span>
              <span className="font-bold font-mono text-sm sm:text-base">
                {formatCurrencyWithCode(totalAssets, baseCurrency)}
              </span>
            </div>
            <div>
              <span className="opacity-75 block text-[11px]">总负债 / 账单</span>
              <span className="font-bold font-mono text-sm sm:text-base text-rose-200">
                {formatCurrencyWithCode(totalLiabilities, baseCurrency)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Account Section Header & Quick Add Account */}
      <div className="flex items-center justify-between px-1">
        <h2 className="text-base font-bold text-black dark:text-white">我的账户资产</h2>
        <button
          type="button"
          onClick={openAddModal}
          className="flex items-center space-x-1 px-3 py-1.5 rounded-full bg-ios-blue/10 text-ios-blue text-xs font-semibold hover:bg-ios-blue/20 transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>新建账户</span>
        </button>
      </div>

      {/* Account Groups */}
      <div className="space-y-4">
        {groupedAccounts.map((group) => {
          const GroupIcon = group.icon;
          return (
            <div key={group.type} className="space-y-2">
              <div className="flex items-center space-x-2 px-2 text-xs font-bold text-ios-gray-1 uppercase tracking-wider">
                <GroupIcon className="w-3.5 h-3.5" />
                <span>{group.label}</span>
              </div>

              <div className="bg-white dark:bg-[#1C1C1E] rounded-3xl overflow-hidden shadow-ios-card border border-black/[0.04] dark:border-white/[0.06] divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                {group.items.map((acc) => {
                  const isMulti = acc.currency !== baseCurrency;
                  const converted = convertAmount(acc.balance, acc.currency, baseCurrency, rates);

                  return (
                    <div
                      key={acc.id}
                      className="p-4 flex items-center justify-between hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <div
                          className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-sm"
                          style={{ backgroundColor: acc.color || "#007AFF" }}
                        >
                          <GroupIcon className="w-5 h-5" />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-bold text-black dark:text-white truncate">
                              {acc.name}
                            </span>
                            {acc.isDefault && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-ios-blue/10 text-ios-blue font-semibold shrink-0">
                                默认
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-ios-gray-1 font-mono">
                            {acc.currency}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3 shrink-0 ml-3">
                        <div className="text-right">
                          <div className="text-sm sm:text-base font-bold font-mono text-black dark:text-white">
                            {formatCurrencyWithCode(acc.balance, acc.currency)}
                          </div>
                          {isMulti && (
                            <div className="text-[10px] text-ios-gray-1 font-mono">
                              ≈ {formatCurrencyWithCode(converted, baseCurrency)}
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => openEditModal(acc)}
                          className="p-1.5 rounded-xl text-ios-gray-2 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Transfer Modal */}
      <TransferModal
        isOpen={isTransferOpen}
        onClose={() => setIsTransferOpen(false)}
        accounts={accounts}
        rates={rates}
        baseCurrency={baseCurrency}
        onTransfer={onTransfer}
      />

      {/* Add / Edit Account Modal */}
      <AnimatePresence>
        {isAddAccountOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddAccountOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-white dark:bg-[#1C1C1E] rounded-3xl shadow-2xl overflow-hidden border border-black/10 dark:border-white/10 z-10"
            >
              <div className="px-5 py-4 flex items-center justify-between border-b border-black/[0.05] dark:border-white/[0.05]">
                <h3 className="text-base font-bold text-black dark:text-white">
                  {editingAccount ? "编辑账户" : "新增账户"}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAddAccountOpen(false)}
                  className="w-8 h-8 rounded-full bg-ios-gray-5 dark:bg-ios-gray-dark4 flex items-center justify-center text-ios-gray-1 hover:text-black dark:hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveAccount} className="p-5 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-ios-gray-1">账户名称</label>
                  <input
                    type="text"
                    required
                    placeholder="如：招商银行工资卡、微信钱包..."
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-ios-gray-5 dark:bg-ios-gray-dark4 rounded-xl text-xs sm:text-sm text-black dark:text-white outline-none border border-transparent focus:border-ios-blue"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-ios-gray-1">账户类型</label>
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value as Account["type"])}
                      className="w-full mt-1 px-3 py-2 bg-ios-gray-5 dark:bg-ios-gray-dark4 rounded-xl text-xs font-semibold text-black dark:text-white outline-none cursor-pointer"
                    >
                      <option value="cash">现金 (Cash)</option>
                      <option value="debit">储蓄卡 / 银行</option>
                      <option value="credit">信用卡 / 负债</option>
                      <option value="other">多币种 / 投资 / 其他</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-ios-gray-1">结算币种</label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full mt-1 px-3 py-2 bg-ios-gray-5 dark:bg-ios-gray-dark4 rounded-xl text-xs font-semibold text-black dark:text-white outline-none cursor-pointer font-mono"
                    >
                      {getAllCurrencies().map((curr) => (
                        <option key={curr.code} value={curr.code}>
                          {curr.code} ({curr.name})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-ios-gray-1">账户初始 / 当前余额</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={balance}
                    onChange={(e) => setBalance(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-ios-gray-5 dark:bg-ios-gray-dark4 rounded-xl text-sm font-mono font-bold text-black dark:text-white outline-none border border-transparent focus:border-ios-blue"
                  />
                </div>

                {/* Color Selector */}
                <div>
                  <label className="text-xs font-semibold text-ios-gray-1">卡片主题色</label>
                  <div className="flex items-center space-x-2 mt-1.5">
                    {["#007AFF", "#34C759", "#FF9500", "#FF2D55", "#AF52DE", "#5856D6", "#5AC8FA"].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        className={`w-7 h-7 rounded-full transition-transform cursor-pointer ${
                          color === c ? "scale-125 ring-2 ring-offset-2 ring-black dark:ring-white" : ""
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <label className="text-xs font-semibold text-black dark:text-white flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isDefault}
                      onChange={(e) => setIsDefault(e.target.checked)}
                      className="rounded text-ios-blue focus:ring-0"
                    />
                    <span>设为默认出账账户</span>
                  </label>

                  {editingAccount && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (confirm(`确定要删除账户 "${editingAccount.name}" 吗？`)) {
                          await onDeleteAccount(editingAccount.id);
                          setIsAddAccountOpen(false);
                        }
                      }}
                      className="text-xs text-red-500 hover:underline cursor-pointer"
                    >
                      删除账户
                    </button>
                  )}
                </div>

                <div className="pt-3 flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsAddAccountOpen(false)}
                    className="flex-1 py-2.5 rounded-2xl bg-ios-gray-5 dark:bg-ios-gray-dark4 text-xs font-semibold text-black dark:text-white cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-2xl bg-ios-blue text-white text-xs font-bold shadow-md hover:brightness-105 active:scale-95 transition-all cursor-pointer"
                  >
                    保存账户
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
