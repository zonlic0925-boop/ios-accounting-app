import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRightLeft } from "lucide-react";
import type { Account } from "../db";
import { convertAmount, formatCurrencyWithCode } from "../services/currency";
import { useModalBackClose } from "../hooks/useModalBackClose";
import { haptics } from "../lib/haptics";

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  rates: Record<string, number>;
  baseCurrency?: string;
  onTransfer: (data: {
    fromAccountId: string;
    toAccountId: string;
    fromAmount: number;
    toAmount: number;
    date: string;
    note?: string;
  }) => Promise<void>;
}

export const TransferModal: React.FC<TransferModalProps> = ({
  isOpen,
  onClose,
  accounts,
  rates,
  onTransfer,
}) => {
  // Android system back closes the modal instead of exiting the app
  useModalBackClose(isOpen, onClose);
  const [fromAccountId, setFromAccountId] = useState<string>(accounts[0]?.id || "");
  const [toAccountId, setToAccountId] = useState<string>(accounts[1]?.id || "");
  const [fromAmountStr, setFromAmountStr] = useState<string>("");
  const [customToAmountStr, setCustomToAmountStr] = useState<string>("");
  const [date, setDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [note, setNote] = useState<string>("");

  const fromAcc = accounts.find((a) => a.id === fromAccountId);
  const toAcc = accounts.find((a) => a.id === toAccountId);

  const fromAmount = parseFloat(fromAmountStr) || 0;
  const isDifferentCurrency = fromAcc && toAcc && fromAcc.currency !== toAcc.currency;

  // Calculate standard converted toAmount based on current exchange rates
  const calculatedToAmount =
    fromAcc && toAcc && fromAmount > 0
      ? convertAmount(fromAmount, fromAcc.currency, toAcc.currency, rates)
      : 0;

  const finalToAmount =
    customToAmountStr !== "" ? parseFloat(customToAmountStr) || 0 : calculatedToAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromAccountId || !toAccountId || fromAccountId === toAccountId) {
      haptics.error();
      return;
    }
    if (fromAmount <= 0) {
      haptics.error();
      return;
    }

    haptics.success();
    await onTransfer({
      fromAccountId,
      toAccountId,
      fromAmount,
      toAmount: finalToAmount > 0 ? finalToAmount : fromAmount,
      date,
      note: note.trim() || `从 ${fromAcc?.name} 转账至 ${toAcc?.name}`,
    });

    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
          />

          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="relative w-full max-w-md bg-white dark:bg-[#1C1C1E] rounded-3xl shadow-2xl overflow-hidden border border-black/10 dark:border-white/10 z-10"
          >
            {/* Modal Header */}
            <div className="px-5 py-4 flex items-center justify-between border-b border-black/[0.05] dark:border-white/[0.05]">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-ios-blue/10 text-ios-blue flex items-center justify-center">
                  <ArrowRightLeft className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-black dark:text-white">
                  账户互转 (含跨币种折算)
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-ios-gray-5 dark:bg-ios-gray-dark4 flex items-center justify-center text-ios-gray-1 hover:text-black dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {/* Account Selection Pair */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-ios-gray-6 dark:bg-ios-gray-dark4 p-3 rounded-2xl">
                  <label className="text-[10px] font-bold text-ios-gray-1 uppercase tracking-wider block mb-1">
                    转出账户
                  </label>
                  <select
                    value={fromAccountId}
                    onChange={(e) => setFromAccountId(e.target.value)}
                    className="w-full bg-transparent text-xs font-semibold text-black dark:text-white outline-none cursor-pointer"
                  >
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.currency})
                      </option>
                    ))}
                  </select>
                  {fromAcc && (
                    <div className="text-[10px] text-ios-gray-1 mt-1">
                      余额: {formatCurrencyWithCode(fromAcc.balance, fromAcc.currency)}
                    </div>
                  )}
                </div>

                <div className="bg-ios-gray-6 dark:bg-ios-gray-dark4 p-3 rounded-2xl">
                  <label className="text-[10px] font-bold text-ios-gray-1 uppercase tracking-wider block mb-1">
                    转入账户
                  </label>
                  <select
                    value={toAccountId}
                    onChange={(e) => setToAccountId(e.target.value)}
                    className="w-full bg-transparent text-xs font-semibold text-black dark:text-white outline-none cursor-pointer"
                  >
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.currency})
                      </option>
                    ))}
                  </select>
                  {toAcc && (
                    <div className="text-[10px] text-ios-gray-1 mt-1">
                      余额: {formatCurrencyWithCode(toAcc.balance, toAcc.currency)}
                    </div>
                  )}
                </div>
              </div>

              {/* Amount Input Section */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-ios-gray-1">转出金额</label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-sm font-bold text-ios-gray-1 font-mono">
                    {fromAcc?.currency}
                  </span>
                  <input
                    type="number"
                    step="any"
                    value={fromAmountStr}
                    onChange={(e) => setFromAmountStr(e.target.value)}
                    placeholder="0.00"
                    required
                    className="w-full pl-14 pr-3 py-2.5 bg-ios-gray-5 dark:bg-ios-gray-dark4 rounded-2xl text-base font-bold font-mono text-black dark:text-white outline-none border border-transparent focus:border-ios-blue"
                  />
                </div>
              </div>

              {/* Multi-currency Conversion Calculation */}
              {isDifferentCurrency && (
                <div className="p-3 rounded-2xl bg-ios-blue/5 dark:bg-ios-blue/10 border border-ios-blue/20 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-ios-blue font-medium">
                      跨币种转换 ({fromAcc.currency} → {toAcc.currency})
                    </span>
                    <span className="text-ios-blue font-bold font-mono">
                      系统估算: {toAcc.currency} {calculatedToAmount.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <label className="text-[11px] text-ios-gray-1 shrink-0">实际到账金额:</label>
                    <input
                      type="number"
                      step="any"
                      placeholder={calculatedToAmount.toFixed(2)}
                      value={customToAmountStr}
                      onChange={(e) => setCustomToAmountStr(e.target.value)}
                      className="w-full bg-white dark:bg-ios-gray-dark3 px-2 py-1 rounded-xl text-xs font-mono text-black dark:text-white outline-none border border-black/10 dark:border-white/10"
                    />
                  </div>
                </div>
              )}

              {/* Date & Note inputs */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-ios-gray-1">转账日期</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full mt-1 bg-ios-gray-5 dark:bg-ios-gray-dark4 text-black dark:text-white text-xs p-2 rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-ios-gray-1">转账备注</label>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="转账备注 (选填)"
                    className="w-full mt-1 bg-ios-gray-5 dark:bg-ios-gray-dark4 text-black dark:text-white text-xs p-2 rounded-xl outline-none"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center space-x-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-2xl bg-ios-gray-5 dark:bg-ios-gray-dark4 text-xs font-semibold text-black dark:text-white cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-2xl bg-ios-blue text-white text-xs font-bold shadow-md hover:brightness-105 active:scale-95 transition-all cursor-pointer"
                >
                  确认转账
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
