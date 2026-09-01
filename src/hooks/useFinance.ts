import { useState, useEffect, useCallback } from "react";
import {
  repository,
  type TransactionFilter,
  type NetWorthSummary,
  type TransferParams,
  type SharedSettlementSummary,
} from "../services/dataRepository";
import {
  currencyService,
  formatMoney,
  convertAmount,
  getRate,
  getCurrencyInfo,
  getAllCurrencies,
  getPopularCurrencies,
} from "../services/currency";
import {
  type Transaction,
  type Account,
  type Category,
  type TransactionType,
  initializeDatabase,
} from "../db";

/**
 * Hook for managing active base currency and multi-currency exchange rates
 */
export function useCurrency() {
  const [baseCurrency, setBaseCurrencyState] = useState<string>(currencyService.getBaseCurrency());
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<number>(currencyService.getLastUpdatedTimestamp());
  const [syncSource, setSyncSource] = useState<string>(currencyService.getSyncSource());
  const [customRates, setCustomRates] = useState<Record<string, number>>(currencyService.getCustomRates());

  useEffect(() => {
    // Read persisted base currency on mount
    repository.getBaseCurrency().then((cur: string) => {
      setBaseCurrencyState(cur);
    });

    // Background sync exchange rates
    repository.getSetting<boolean>("auto_sync_rates", true).then((autoSync: boolean) => {
      if (autoSync) {
        currencyService.syncExchangeRates().then((res: { success: boolean; error?: string; timestamp: number }) => {
          if (res.success) {
            setLastSyncTime(res.timestamp);
            setSyncSource(currencyService.getSyncSource());
          }
        });
      }
    });
  }, []);

  const changeBaseCurrency = useCallback(async (newCurrency: string) => {
    const res = await repository.switchBaseCurrency(newCurrency);
    setBaseCurrencyState(res.newBaseCurrency);
    return res;
  }, []);

  const syncRates = useCallback(async (force: boolean = true) => {
    setIsSyncing(true);
    try {
      const res = await currencyService.syncExchangeRates(force);
      setLastSyncTime(res.timestamp);
      setSyncSource(currencyService.getSyncSource());
      return res;
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const updateCustomRate = useCallback((currencyCode: string, rateToUSD: number) => {
    currencyService.setCustomRate(currencyCode, rateToUSD);
    setCustomRates(currencyService.getCustomRates());
  }, []);

  const removeCustomRate = useCallback((currencyCode: string) => {
    currencyService.removeCustomRate(currencyCode);
    setCustomRates(currencyService.getCustomRates());
  }, []);

  const resetAllCustomRates = useCallback(() => {
    currencyService.resetCustomRates();
    setCustomRates({});
  }, []);

  return {
    baseCurrency,
    baseCurrencyInfo: getCurrencyInfo(baseCurrency),
    rates: currencyService.getAllRates(),
    loading: isSyncing,
    refreshRates: syncRates,
    changeBaseCurrency,
    isSyncing,
    lastSyncTime,
    syncSource,
    syncRates,
    customRates,
    updateCustomRate,
    removeCustomRate,
    resetAllCustomRates,
    allCurrencies: getAllCurrencies(),
    popularCurrencies: getPopularCurrencies(),
    formatMoney: (amount: number, code: string = baseCurrency) => formatMoney(amount, code),
    convertAmount: (amount: number, from: string, to: string = baseCurrency) => convertAmount(amount, from, to),
    getRate: (from: string, to: string = baseCurrency) => getRate(from, to),
    getCurrencyInfo,
  };
}

/**
 * Hook for Transaction management and reactivity
 */
export function useTransactions(filter?: TransactionFilter) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const reloadTransactions = useCallback(async () => {
    setLoading(true);
    try {
      await initializeDatabase();
      const list = await repository.getTransactions(filter);
      setTransactions(list);
    } catch (e) {
      console.error("Failed to load transactions:", e);
    } finally {
      setLoading(false);
    }
  }, [filter?.ledgerId, filter?.startDate, filter?.endDate, filter?.categoryId, filter?.accountId, filter?.type, filter?.query]);

  useEffect(() => {
    reloadTransactions();
  }, [reloadTransactions]);

  const addTransaction = useCallback(
    async (
      tx: Omit<Transaction, "id" | "baseAmount" | "baseCurrency" | "exchangeRate" | "createdAt" | "updatedAt"> & {
        baseCurrency?: string;
        exchangeRate?: number;
        baseAmount?: number;
      }
    ) => {
      const id = await repository.createTransaction(tx);
      await reloadTransactions();
      return id;
    },
    [reloadTransactions]
  );

  const updateTransaction = useCallback(
    async (id: number, updates: Partial<Omit<Transaction, "id" | "createdAt">>) => {
      await repository.updateTransaction(id, updates);
      await reloadTransactions();
    },
    [reloadTransactions]
  );

  const deleteTransaction = useCallback(
    async (id: number) => {
      await repository.deleteTransaction(id);
      await reloadTransactions();
    },
    [reloadTransactions]
  );

  const transferAccounts = useCallback(
    async (params: TransferParams) => {
      const txId = await repository.transferBetweenAccounts(params);
      await reloadTransactions();
      return txId;
    },
    [reloadTransactions]
  );

  return {
    transactions,
    loading,
    reloadTransactions,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    transferAccounts,
  };
}

/**
 * Hook for Accounts and Net Worth Calculation
 */
export function useAccounts(targetCurrency?: string) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [netWorth, setNetWorth] = useState<NetWorthSummary>({
    totalNetWorth: 0,
    totalAssets: 0,
    totalLiabilities: 0,
    baseCurrency: targetCurrency || "CNY",
    accountBreakdown: [],
  });
  const [loading, setLoading] = useState<boolean>(true);

  const reloadAccounts = useCallback(async () => {
    setLoading(true);
    try {
      await initializeDatabase();
      const accList = await repository.getAccounts();
      const summary = await repository.getTotalNetWorth(targetCurrency);
      setAccounts(accList);
      setNetWorth(summary);
    } catch (e) {
      console.error("Failed to load accounts:", e);
    } finally {
      setLoading(false);
    }
  }, [targetCurrency]);

  useEffect(() => {
    reloadAccounts();
  }, [reloadAccounts]);

  const addAccount = useCallback(
    async (account: Omit<Account, "id" | "createdAt" | "updatedAt">) => {
      const id = await repository.createAccount(account as Account);
      await reloadAccounts();
      return id;
    },
    [reloadAccounts]
  );

  const updateAccount = useCallback(
    async (id: string, updates: Partial<Account>) => {
      await repository.updateAccount(id, updates);
      await reloadAccounts();
    },
    [reloadAccounts]
  );

  const deleteAccount = useCallback(
    async (id: string) => {
      await repository.deleteAccount(id);
      await reloadAccounts();
    },
    [reloadAccounts]
  );

  const transferBetweenAccounts = useCallback(
    async (params: TransferParams) => {
      const txId = await repository.transferBetweenAccounts(params);
      await reloadAccounts();
      return txId;
    },
    [reloadAccounts]
  );

  return {
    accounts,
    netWorth,
    loading,
    reloadAccounts,
    addAccount,
    updateAccount,
    deleteAccount,
    transferBetweenAccounts,
  };
}

/**
 * Hook for Categories
 */
export function useCategories(type?: TransactionType) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const reloadCategories = useCallback(async () => {
    setLoading(true);
    try {
      await initializeDatabase();
      const list = await repository.getCategories(type);
      setCategories(list);
    } catch (e) {
      console.error("Failed to load categories:", e);
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    reloadCategories();
  }, [reloadCategories]);

  return {
    categories,
    loading,
    reloadCategories,
  };
}

/**
 * Hook for Settings and Data Operations
 */
export function useSettings() {
  const [theme, setThemeState] = useState<"system" | "light" | "dark">("system");
  const [soundEnabled, setSoundEnabledState] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    repository.getSetting<"system" | "light" | "dark">("theme", "system").then(setThemeState);
    repository.getSetting<boolean>("sound_effects", true).then(setSoundEnabledState);
  }, []);

  const setTheme = useCallback(async (newTheme: "system" | "light" | "dark") => {
    setThemeState(newTheme);
    await repository.setSetting("theme", newTheme);
  }, []);

  const toggleSound = useCallback(async (enabled: boolean) => {
    setSoundEnabledState(enabled);
    await repository.setSetting("sound_effects", enabled);
  }, []);

  const exportCSV = useCallback(async () => {
    try {
      const csvData = await repository.exportCSV();
      // Add UTF-8 BOM for Excel compatibility in Chinese and other languages
      const blob = new Blob(["\ufeff" + csvData], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const timestamp = new Date().toISOString().slice(0, 10);
      link.setAttribute("href", url);
      link.setAttribute("download", `记账账本_${timestamp}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return csvData;
    } catch (error) {
      console.error("Export CSV failed:", error);
      throw error;
    }
  }, []);

  const importCSV = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement> | string) => {
      setLoading(true);
      try {
        if (typeof e === "string") {
          return await repository.importCSV(e);
        }
        const file = e.target.files?.[0];
        if (!file) return 0;
        const text = await file.text();
        const count = await repository.importCSV(text);
        e.target.value = ""; // reset input
        return count;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const resetData = useCallback(async () => {
    setLoading(true);
    try {
      await repository.resetAllData();
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    theme,
    setTheme,
    soundEnabled,
    toggleSound,
    loading,
    exportCSV,
    importCSV,
    resetData,
  };
}

/**
 * Hook for Couples Shared Ledger settlement calculation and actions
 */
export function useSharedLedger() {
  const [settlement, setSettlement] = useState<SharedSettlementSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const reloadSettlement = useCallback(async () => {
    try {
      const summary = await repository.getSharedSettlementSummary();
      setSettlement(summary);
    } catch (e) {
      console.error("Failed to load shared settlement:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reloadSettlement();
  }, [reloadSettlement]);

  const settleUp = useCallback(async (note?: string) => {
    setLoading(true);
    try {
      const id = await repository.settleSharedLedger(note);
      await reloadSettlement();
      return id;
    } finally {
      setLoading(false);
    }
  }, [reloadSettlement]);

  return {
    settlement,
    loading,
    reloadSettlement,
    settleUp,
  };
}

/**
 * Unified hook combining all financial state for convenience
 */
export function useFinance(filter?: TransactionFilter) {
  const currency = useCurrency();
  const transactions = useTransactions(filter);
  const accounts = useAccounts();
  const categories = useCategories();
  const settings = useSettings();
  const shared = useSharedLedger();

  const refreshAll = useCallback(async () => {
    await Promise.all([
      transactions.reloadTransactions(),
      accounts.reloadAccounts(),
      categories.reloadCategories(),
      shared.reloadSettlement(),
    ]);
  }, [transactions, accounts, categories, shared]);

  return {
    currency,
    transactions,
    accounts,
    categories,
    settings,
    shared,
    refreshAll,
  };
}


