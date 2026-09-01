import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Receipt,
  PieChart,
  Wallet,
  Settings,
  Plus,
  Sun,
  Moon,
  Laptop,
  User,
  Heart,
} from "lucide-react";
import { useFinance } from "./hooks/useFinance";
import type { LedgerId } from "./db";
import { TransactionsView } from "./components/TransactionsView";
import { AnalyticsView } from "./components/AnalyticsView";
import { AccountsView } from "./components/AccountsView";
import { SettingsView } from "./components/SettingsView";
import { QuickAddModal } from "./components/QuickAddModal";
import { haptics } from "./lib/haptics";

type TabType = "transactions" | "analytics" | "accounts" | "settings";

export function App() {
  const {
    transactions: { transactions, loading: txLoading, addTransaction, deleteTransaction },
    categories: { categories },
    accounts: {
      accounts,
      loading: accLoading,
      addAccount,
      updateAccount,
      deleteAccount,
      transferBetweenAccounts,
    },
    currency: { baseCurrency, rates, loading: currLoading, changeBaseCurrency, refreshRates },
    settings: { theme, setTheme, soundEnabled, toggleSound, exportCSV, importCSV, resetData },
    shared: sharedLedger,
    refreshAll,
  } = useFinance();

  const loading = txLoading || accLoading || currLoading;

  const [activeTab, setActiveTab] = useState<TabType>("transactions");
  const [activeLedger, setActiveLedger] = useState<LedgerId>("personal");
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddType, setQuickAddType] = useState<"expense" | "income">("expense");

  // Filter transactions by active ledger (personal vs shared)
  const currentLedgerTransactions = useMemo(() => {
    return transactions.filter(
      (tx) => (tx.ledgerId || "personal") === activeLedger
    );
  }, [transactions, activeLedger]);

  // Keep haptics audio state synchronized
  useEffect(() => {
    haptics.setEnabled(soundEnabled);
  }, [soundEnabled]);

  // Keep theme class and system preference synchronized on documentElement
  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const applyTheme = () => {
      const isDark =
        theme === "dark" || (theme === "system" && mediaQuery.matches);
      if (isDark) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    };

    applyTheme();

    const handler = () => {
      if (theme === "system") {
        applyTheme();
      }
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [theme]);

  // Handle Quick Add trigger
  const handleOpenQuickAdd = (type: "expense" | "income" = "expense") => {
    haptics.selection();
    setQuickAddType(type);
    setIsQuickAddOpen(true);
  };

  const handleTabChange = (tab: TabType) => {
    haptics.selection();
    setActiveTab(tab);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-ios-background dark:bg-ios-background-dark flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-ios-blue flex items-center justify-center text-white shadow-lg animate-pulse">
          <Wallet className="w-6 h-6" />
        </div>
        <p className="text-sm font-medium text-ios-gray-1">正在加载个人财务账本...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ios-background dark:bg-ios-background-dark text-black dark:text-white flex justify-center selection:bg-ios-blue selection:text-white transition-colors duration-200">
      {/* Mobile-centric constrained container with desktop elegance */}
      <div className="w-full max-w-lg min-h-screen flex flex-col relative px-4 sm:px-6 pt-4 sm:pt-6 pb-24">
        {/* iOS Dynamic Island / Status area styling decoration & Ledger Switcher */}
        <header className="flex items-center justify-between pb-3.5 pt-1">
          <div className="flex items-center space-x-2">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-sm transition-all duration-300 ${
              activeLedger === "shared"
                ? "bg-gradient-to-tr from-pink-500 to-rose-500 shadow-rose-500/30"
                : "bg-ios-blue shadow-ios-blue/30"
            }`}>
              {activeLedger === "shared" ? (
                <Heart className="w-4 h-4 fill-current" />
              ) : (
                <Wallet className="w-4 h-4" />
              )}
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="text-base font-bold tracking-tight">
                  {activeLedger === "shared" ? "情侣共享" : "个人私密"}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-ios-gray-5 dark:bg-ios-gray-dark4 text-ios-gray-1 font-mono uppercase">
                  {baseCurrency}
                </span>
              </div>
            </div>
          </div>

          {/* Central / Right Controls: Ledger Switcher + Theme */}
          <div className="flex items-center space-x-2">
            {/* iOS Segmented Pill Switcher */}
            <div className="flex items-center bg-ios-gray-5 dark:bg-ios-gray-dark4 p-1 rounded-2xl border border-black/[0.04] dark:border-white/[0.08]">
              <button
                type="button"
                onClick={() => {
                  setActiveLedger("personal");
                  haptics.selection();
                }}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeLedger === "personal"
                    ? "bg-white dark:bg-ios-gray-dark2 text-ios-blue shadow-sm"
                    : "text-ios-gray-1 dark:text-ios-gray-2 hover:text-black dark:hover:text-white"
                }`}
              >
                <User className="w-3 h-3" />
                <span>个人</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveLedger("shared");
                  haptics.selection();
                  sharedLedger.reloadSettlement();
                }}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeLedger === "shared"
                    ? "bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-sm"
                    : "text-ios-gray-1 dark:text-ios-gray-2 hover:text-black dark:hover:text-white"
                }`}
              >
                <Heart className="w-3 h-3 fill-current" />
                <span>共享</span>
              </button>
            </div>

            {/* Quick theme switcher button */}
            <button
              type="button"
              onClick={() => {
                const nextTheme =
                  theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
                setTheme(nextTheme);
                haptics.selection();
              }}
              className="w-8 h-8 rounded-full bg-white dark:bg-ios-gray-dark3 shadow-sm border border-black/5 dark:border-white/10 flex items-center justify-center text-ios-gray-1 hover:text-black dark:hover:text-white cursor-pointer transition-colors"
              title="切换主题"
            >
              {theme === "light" ? (
                <Sun className="w-4 h-4 text-orange-500" />
              ) : theme === "dark" ? (
                <Moon className="w-4 h-4 text-ios-blue" />
              ) : (
                <Laptop className="w-4 h-4 text-ios-gray-1" />
              )}
            </button>
          </div>
        </header>

        {/* Main Tab Views with Smooth Transition */}
        <main className="flex-1">
          <AnimatePresence mode="wait">
            {activeTab === "transactions" && (
              <motion.div
                key="transactions"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
              >
                <TransactionsView
                  transactions={currentLedgerTransactions}
                  categories={categories}
                  accounts={accounts}
                  baseCurrency={baseCurrency}
                  currentLedger={activeLedger}
                  settlementSummary={sharedLedger.settlement}
                  onSettleDebt={async () => {
                    await sharedLedger.settleUp();
                    await refreshAll();
                  }}
                  onDeleteTransaction={deleteTransaction}
                  onOpenQuickAdd={handleOpenQuickAdd}
                />
              </motion.div>
            )}

            {activeTab === "analytics" && (
              <motion.div
                key="analytics"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
              >
                <AnalyticsView
                  transactions={transactions}
                  categories={categories}
                  baseCurrency={baseCurrency}
                />
              </motion.div>
            )}

            {activeTab === "accounts" && (
              <motion.div
                key="accounts"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
              >
                <AccountsView
                  accounts={accounts}
                  rates={rates}
                  baseCurrency={baseCurrency}
                  onAddAccount={async (acc) => {
                    await addAccount(acc);
                  }}
                  onUpdateAccount={updateAccount}
                  onDeleteAccount={deleteAccount}
                  onTransfer={async (data) => {
                    await transferBetweenAccounts(data);
                  }}
                />
              </motion.div>
            )}

            {activeTab === "settings" && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
              >
                <SettingsView
                  baseCurrency={baseCurrency}
                  rates={rates}
                  theme={theme}
                  soundEnabled={soundEnabled}
                  onCurrencyChange={async (curr) => {
                    await changeBaseCurrency(curr);
                    await refreshAll();
                  }}
                  onThemeChange={setTheme}
                  onToggleSound={() => toggleSound(!soundEnabled)}
                  onRefreshRates={async () => {
                    await refreshRates();
                    await refreshAll();
                  }}
                  onExportCSV={exportCSV}
                  onImportCSV={async (e) => {
                    await importCSV(e);
                    await refreshAll();
                  }}
                  onResetData={async () => {
                    await resetData();
                    await refreshAll();
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Floating iOS Dock / TabBar with Center Quick Add Button */}
        <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pointer-events-none pb-4 sm:pb-6 px-4">
          <div className="pointer-events-auto w-full max-w-md bg-white/80 dark:bg-[#1C1C1E]/80 backdrop-blur-xl border border-black/10 dark:border-white/10 rounded-full shadow-2xl px-3 py-2 flex items-center justify-around">
            {/* Tab: 明细 */}
            <button
              type="button"
              onClick={() => handleTabChange("transactions")}
              className={`flex flex-col items-center justify-center w-14 py-1 rounded-2xl transition-all cursor-pointer ${
                activeTab === "transactions"
                  ? "text-ios-blue font-semibold scale-105"
                  : "text-ios-gray-1 hover:text-black dark:hover:text-white"
              }`}
            >
              <Receipt className="w-5 h-5" />
              <span className="text-[10px] mt-0.5">明细</span>
            </button>

            {/* Tab: 统计 */}
            <button
              type="button"
              onClick={() => handleTabChange("analytics")}
              className={`flex flex-col items-center justify-center w-14 py-1 rounded-2xl transition-all cursor-pointer ${
                activeTab === "analytics"
                  ? "text-ios-blue font-semibold scale-105"
                  : "text-ios-gray-1 hover:text-black dark:hover:text-white"
              }`}
            >
              <PieChart className="w-5 h-5" />
              <span className="text-[10px] mt-0.5">统计</span>
            </button>

            {/* Central Floating Quick Add Button */}
            <div className="relative -top-4 flex items-center justify-center">
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                type="button"
                onClick={() => handleOpenQuickAdd("expense")}
                className="w-13 h-13 rounded-full bg-ios-blue text-white shadow-lg shadow-ios-blue/40 flex items-center justify-center cursor-pointer border-4 border-ios-background dark:border-ios-background-dark"
                title="快速记账"
              >
                <Plus className="w-7 h-7 stroke-[2.5]" />
              </motion.button>
            </div>

            {/* Tab: 资产 */}
            <button
              type="button"
              onClick={() => handleTabChange("accounts")}
              className={`flex flex-col items-center justify-center w-14 py-1 rounded-2xl transition-all cursor-pointer ${
                activeTab === "accounts"
                  ? "text-ios-blue font-semibold scale-105"
                  : "text-ios-gray-1 hover:text-black dark:hover:text-white"
              }`}
            >
              <Wallet className="w-5 h-5" />
              <span className="text-[10px] mt-0.5">资产</span>
            </button>

            {/* Tab: 设置 */}
            <button
              type="button"
              onClick={() => handleTabChange("settings")}
              className={`flex flex-col items-center justify-center w-14 py-1 rounded-2xl transition-all cursor-pointer ${
                activeTab === "settings"
                  ? "text-ios-blue font-semibold scale-105"
                  : "text-ios-gray-1 hover:text-black dark:hover:text-white"
              }`}
            >
              <Settings className="w-5 h-5" />
              <span className="text-[10px] mt-0.5">设置</span>
            </button>
          </div>
        </div>

        {/* Quick Add Modal */}
        <QuickAddModal
          isOpen={isQuickAddOpen}
          onClose={() => setIsQuickAddOpen(false)}
          categories={categories}
          accounts={accounts}
          baseCurrency={baseCurrency}
          rates={rates}
          currentLedger={activeLedger}
          onAddTransaction={async (tx) => {
            await addTransaction(tx);
            await refreshAll();
            await sharedLedger.reloadSettlement();
          }}
          initialType={quickAddType}
        />
      </div>
    </div>
  );
}

export default App;
