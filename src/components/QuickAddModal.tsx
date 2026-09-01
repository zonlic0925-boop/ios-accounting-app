import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Calendar,
  FileText,
  CreditCard,
  Layers,
  ArrowRightLeft,
  ChevronDown,
  Heart,
  User,
  Users,
} from "lucide-react";
import type { Account, Category, LedgerId, PayerType, SplitRule } from "../db";
import { IOSKeypad } from "./IOSKeypad";
import { CategoryIcon } from "./CategoryIcon";
import { convertAmount, formatCurrencyWithCode, getAllCurrencies } from "../services/currency";
import { haptics } from "../lib/haptics";

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  accounts: Account[];
  baseCurrency: string;
  rates: Record<string, number>;
  currentLedger?: LedgerId;
  onAddTransaction: (transaction: {
    title: string;
    type: "expense" | "income";
    amount: number;
    currency: string;
    baseAmount: number;
    categoryId: string;
    categoryName: string;
    accountId: string;
    date: string;
    note?: string;
    ledgerId?: LedgerId;
    payer?: PayerType;
    splitRule?: SplitRule;
  }) => Promise<void>;
  initialType?: "expense" | "income";
}

export const QuickAddModal: React.FC<QuickAddModalProps> = ({
  isOpen,
  onClose,
  categories,
  accounts,
  baseCurrency,
  rates,
  currentLedger = "personal",
  onAddTransaction,
  initialType = "expense",
}) => {
  const [type, setType] = useState<"expense" | "income">(initialType);
  const [targetLedger, setTargetLedger] = useState<LedgerId>(currentLedger);
  const [payer, setPayer] = useState<PayerType>("me");
  const [splitRule, setSplitRule] = useState<SplitRule>("50_50");
  const [expression, setExpression] = useState<string>("0");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [selectedCurrency, setSelectedCurrency] = useState<string>(baseCurrency);
  const [date, setDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [note, setNote] = useState<string>("");
  const [showCurrencyPicker, setShowCurrencyPicker] = useState<boolean>(false);
  const [showAccountPicker, setShowAccountPicker] = useState<boolean>(false);

  // Filter categories by type
  const filteredCategories = categories.filter((c) => c.type === type);

  // Initialize defaults
  useEffect(() => {
    if (isOpen) {
      setType(initialType);
      setTargetLedger(currentLedger);
      setPayer("me");
      setSplitRule("50_50");
      setExpression("0");
      setNote("");
      setDate(new Date().toISOString().split("T")[0]);
      
      const defaultCat = categories.find((c) => c.type === initialType);
      if (defaultCat) {
        setSelectedCategoryId(defaultCat.id);
      }
      
      if (accounts.length > 0) {
        const defaultAcc = accounts.find((a) => a.isDefault) || accounts[0];
        setSelectedAccountId(defaultAcc.id);
        setSelectedCurrency(defaultAcc.currency || baseCurrency);
      }
    }
  }, [isOpen, initialType, categories, accounts, baseCurrency, currentLedger]);

  // When type changes, select first category of that type
  const handleTypeChange = (newType: "expense" | "income") => {
    haptics.selection();
    setType(newType);
    const firstCat = categories.find((c) => c.type === newType);
    if (firstCat) {
      setSelectedCategoryId(firstCat.id);
    }
  };

  // Evaluate current numeric amount from expression
  const parseAmount = (expr: string): number => {
    if (!expr) return 0;
    try {
      let sanitized = expr
        .replace(/×/g, "*")
        .replace(/÷/g, "/")
        .replace(/−/g, "-")
        .replace(/\+/g, "+");
      while (/[+\-*/.]$/.test(sanitized)) {
        sanitized = sanitized.slice(0, -1);
      }
      if (!sanitized) return 0;
      if (!/^[\d+\-*/.\s]+$/.test(sanitized)) return 0;
      // eslint-disable-next-line no-new-func
      const val = new Function(`return (${sanitized})`)();
      return typeof val === "number" && !isNaN(val) && isFinite(val) ? Math.max(0, val) : 0;
    } catch {
      return 0;
    }
  };

  const currentAmount = parseAmount(expression);

  // Calculate real-time conversion into base currency
  const convertedAmount = convertAmount(
    currentAmount,
    selectedCurrency,
    baseCurrency,
    rates
  );

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  const handleSubmit = async () => {
    if (currentAmount <= 0) {
      haptics.error();
      return;
    }

    if (!selectedCategoryId || !selectedAccountId) {
      haptics.error();
      return;
    }

    await onAddTransaction({
      title: selectedCategory?.name || "记账",
      type,
      amount: currentAmount,
      currency: selectedCurrency,
      baseAmount: convertedAmount,
      categoryId: selectedCategoryId,
      categoryName: selectedCategory?.name || "",
      accountId: selectedAccountId,
      date,
      note: note.trim() || undefined,
      ledgerId: targetLedger,
      payer: targetLedger === "shared" ? payer : undefined,
      splitRule: targetLedger === "shared" ? splitRule : undefined,
    });

    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          {/* Backdrop blur overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
          />

          {/* Modal / Sheet Card */}
          <motion.div
            initial={{ y: "100%", opacity: 0.8 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="relative w-full max-w-md bg-ios-background dark:bg-ios-background-dark rounded-t-[32px] sm:rounded-[32px] shadow-2xl overflow-hidden border border-black/[0.08] dark:border-white/[0.1] max-h-[94vh] flex flex-col z-10"
          >
            {/* iOS Modal Grabber */}
            <div className="w-full pt-3 pb-1 flex justify-center items-center sm:hidden">
              <div className="w-10 h-1 rounded-full bg-ios-gray-3 dark:bg-ios-gray-dark3" />
            </div>

            {/* Header / Type Segmented Control & Ledger Switcher */}
            <div className="px-5 pt-2 pb-3 border-b border-black/[0.05] dark:border-white/[0.05] space-y-2.5">
              <div className="flex items-center justify-between">
                {/* Segmented Switcher */}
                <div className="flex bg-ios-gray-5 dark:bg-ios-gray-dark4 p-1 rounded-xl shadow-inner-ios">
                  <button
                    type="button"
                    onClick={() => handleTypeChange("expense")}
                    className={`px-5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                      type === "expense"
                        ? "bg-white dark:bg-ios-gray-dark2 text-red-500 shadow-sm"
                        : "text-ios-gray-1 dark:text-ios-gray-2 hover:text-black dark:hover:text-white"
                    }`}
                  >
                    支出
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTypeChange("income")}
                    className={`px-5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                      type === "income"
                        ? "bg-white dark:bg-ios-gray-dark2 text-emerald-500 shadow-sm"
                        : "text-ios-gray-1 dark:text-ios-gray-2 hover:text-black dark:hover:text-white"
                    }`}
                  >
                    收入
                  </button>
                </div>

                {/* Ledger Switcher Pills */}
                <div className="flex items-center bg-ios-gray-5 dark:bg-ios-gray-dark4 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setTargetLedger("personal");
                      haptics.selection();
                    }}
                    className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      targetLedger === "personal"
                        ? "bg-white dark:bg-ios-gray-dark2 text-ios-blue shadow-sm font-semibold"
                        : "text-ios-gray-1 dark:text-ios-gray-2"
                    }`}
                  >
                    <User className="w-3 h-3" />
                    <span>个人</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTargetLedger("shared");
                      haptics.selection();
                    }}
                    className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      targetLedger === "shared"
                        ? "bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-sm font-semibold"
                        : "text-ios-gray-1 dark:text-ios-gray-2"
                    }`}
                  >
                    <Heart className="w-3 h-3 fill-current" />
                    <span>共享</span>
                  </button>
                </div>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-ios-gray-5 dark:bg-ios-gray-dark4 flex items-center justify-center text-ios-gray-1 hover:text-black dark:hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Shared Ledger Extra Controls (Payer & Split rule) */}
              {targetLedger === "shared" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-2.5 rounded-2xl bg-rose-500/10 dark:bg-rose-500/15 border border-rose-500/20 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" /> 谁垫付了:
                    </span>
                    <div className="flex items-center space-x-1 bg-white/80 dark:bg-ios-gray-dark3 p-0.5 rounded-lg border border-rose-500/15">
                      <button
                        type="button"
                        onClick={() => {
                          setPayer("me");
                          haptics.selection();
                        }}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                          payer === "me"
                            ? "bg-rose-500 text-white shadow-xs"
                            : "text-ios-gray-1 hover:text-black dark:hover:text-white"
                        }`}
                      >
                        我付的 🙋‍♂️
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPayer("partner");
                          haptics.selection();
                        }}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                          payer === "partner"
                            ? "bg-rose-500 text-white shadow-xs"
                            : "text-ios-gray-1 hover:text-black dark:hover:text-white"
                        }`}
                      >
                        对方付的 🙋‍♀️
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-rose-500/15">
                    <span className="text-rose-600 dark:text-rose-400 font-semibold">分摊方式:</span>
                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSplitRule("50_50");
                          haptics.selection();
                        }}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-medium transition-all cursor-pointer ${
                          splitRule === "50_50"
                            ? "bg-rose-500 text-white font-bold"
                            : "bg-white/60 dark:bg-ios-gray-dark3 text-ios-gray-1"
                        }`}
                      >
                        AA平摊 (50%)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSplitRule("100_me");
                          haptics.selection();
                        }}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-medium transition-all cursor-pointer ${
                          splitRule === "100_me"
                            ? "bg-rose-500 text-white font-bold"
                            : "bg-white/60 dark:bg-ios-gray-dark3 text-ios-gray-1"
                        }`}
                      >
                        我全包 (100%)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSplitRule("100_partner");
                          haptics.selection();
                        }}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-medium transition-all cursor-pointer ${
                          splitRule === "100_partner"
                            ? "bg-rose-500 text-white font-bold"
                            : "bg-white/60 dark:bg-ios-gray-dark3 text-ios-gray-1"
                        }`}
                      >
                        对方全包 (100%)
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Amount Display & Currency Conversion */}
            <div className="px-6 py-4 bg-white/70 dark:bg-[#1C1C1E]/70 backdrop-blur-md border-b border-black/[0.05] dark:border-white/[0.05]">
              <div className="flex items-baseline justify-between">
                {/* Currency Selector Pill */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowCurrencyPicker(!showCurrencyPicker)}
                    className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-ios-gray-5 dark:bg-ios-gray-dark4 hover:bg-ios-gray-4 dark:hover:bg-ios-gray-dark3 transition-colors cursor-pointer"
                  >
                    <span className="text-xs font-bold uppercase tracking-wider text-black dark:text-white">
                      {selectedCurrency}
                    </span>
                    <ChevronDown className="w-3 h-3 text-ios-gray-1" />
                  </button>

                  {/* Currency Picker Popover */}
                  {showCurrencyPicker && (
                    <div className="absolute left-0 top-9 z-30 w-44 bg-white dark:bg-ios-gray-dark2 rounded-2xl shadow-xl border border-black/10 dark:border-white/10 py-1.5 max-h-48 overflow-y-auto">
                      {getAllCurrencies().map((curr) => (
                        <button
                          key={curr.code}
                          type="button"
                          onClick={() => {
                            setSelectedCurrency(curr.code);
                            setShowCurrencyPicker(false);
                            haptics.selection();
                          }}
                          className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between hover:bg-black/5 dark:hover:bg-white/5 ${
                            selectedCurrency === curr.code
                              ? "text-ios-blue font-bold"
                              : "text-black dark:text-white"
                          }`}
                        >
                          <span>{curr.name}</span>
                          <span className="font-mono text-ios-gray-1">{curr.code}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Amount Expression Display */}
                <div className="text-right">
                  <div
                    className={`text-3xl sm:text-4xl font-mono font-bold tracking-tight ${
                      type === "expense"
                        ? "text-black dark:text-white"
                        : "text-emerald-500 dark:text-emerald-400"
                    }`}
                  >
                    {expression || "0"}
                  </div>

                  {/* Realtime Conversion Preview */}
                  {selectedCurrency !== baseCurrency && (
                    <div className="flex items-center justify-end space-x-1 mt-1 text-xs text-ios-gray-1 dark:text-ios-gray-2">
                      <ArrowRightLeft className="w-3 h-3" />
                      <span>折合: {formatCurrencyWithCode(convertedAmount, baseCurrency)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Scrollable Form Body */}
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
              {/* Category Horizontal / Grid Picker */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-ios-gray-1">
                    分类 ({selectedCategory?.name || "未选择"})
                  </span>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2.5 max-h-36 overflow-y-auto p-1">
                  {filteredCategories.map((cat) => {
                    const isSelected = selectedCategoryId === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          setSelectedCategoryId(cat.id);
                          haptics.selection();
                        }}
                        className={`flex flex-col items-center justify-center p-2.5 rounded-2xl transition-all cursor-pointer ${
                          isSelected
                            ? "bg-ios-blue text-white shadow-md scale-105"
                            : "bg-white dark:bg-ios-gray-dark3 text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/5 border border-black/[0.03] dark:border-white/[0.05]"
                        }`}
                      >
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center mb-1"
                          style={{
                            backgroundColor: isSelected ? "rgba(255,255,255,0.2)" : `${cat.color}20`,
                            color: isSelected ? "#FFFFFF" : cat.color,
                          }}
                        >
                          <CategoryIcon name={cat.icon} size={16} />
                        </div>
                        <span className="text-[11px] font-medium truncate w-full text-center">
                          {cat.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Account Selector & Date & Note Row */}
              <div className="bg-white dark:bg-ios-gray-dark3 rounded-2xl p-3 border border-black/[0.04] dark:border-white/[0.06] space-y-3">
                {/* Account Selection */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-xs font-medium text-ios-gray-1">
                    <CreditCard className="w-4 h-4 text-ios-blue" />
                    <span>入账账户</span>
                  </div>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowAccountPicker(!showAccountPicker)}
                      className="flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-ios-gray-5 dark:bg-ios-gray-dark4 text-xs font-semibold text-black dark:text-white hover:bg-ios-gray-4 cursor-pointer"
                    >
                      <Layers className="w-3 h-3 text-ios-gray-1" />
                      <span>{selectedAccount ? selectedAccount.name : "选择账户"}</span>
                      <ChevronDown className="w-3 h-3 text-ios-gray-1" />
                    </button>

                    {showAccountPicker && (
                      <div className="absolute right-0 bottom-8 z-30 w-52 bg-white dark:bg-ios-gray-dark2 rounded-2xl shadow-xl border border-black/10 dark:border-white/10 py-1.5 max-h-48 overflow-y-auto">
                        {accounts.map((acc) => (
                          <button
                            key={acc.id}
                            type="button"
                            onClick={() => {
                              setSelectedAccountId(acc.id);
                              if (acc.currency) {
                                setSelectedCurrency(acc.currency);
                              }
                              setShowAccountPicker(false);
                              haptics.selection();
                            }}
                            className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between hover:bg-black/5 dark:hover:bg-white/5 ${
                              selectedAccountId === acc.id
                                ? "text-ios-blue font-bold"
                                : "text-black dark:text-white"
                            }`}
                          >
                            <span>{acc.name}</span>
                            <span className="font-mono text-ios-gray-1 text-[10px]">
                              {acc.currency}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Date Selection */}
                <div className="flex items-center justify-between border-t border-black/[0.04] dark:border-white/[0.04] pt-2.5">
                  <div className="flex items-center space-x-2 text-xs font-medium text-ios-gray-1">
                    <Calendar className="w-4 h-4 text-orange-500" />
                    <span>记录日期</span>
                  </div>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="bg-ios-gray-5 dark:bg-ios-gray-dark4 text-black dark:text-white text-xs px-2.5 py-1 rounded-xl font-mono outline-none border border-transparent focus:border-ios-blue cursor-pointer"
                  />
                </div>

                {/* Note input */}
                <div className="flex items-center space-x-2 border-t border-black/[0.04] dark:border-white/[0.04] pt-2.5">
                  <FileText className="w-4 h-4 text-ios-gray-1 shrink-0" />
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="添加备注信息 (选填)..."
                    className="w-full bg-transparent text-xs text-black dark:text-white outline-none placeholder:text-ios-gray-2"
                  />
                </div>
              </div>

              {/* iOS Numeric Keypad */}
              <div className="pt-1">
                <IOSKeypad
                  expression={expression}
                  onExpressionChange={setExpression}
                  onConfirm={handleSubmit}
                  confirmLabel={type === "expense" ? "记录支出" : "记录收入"}
                />
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
