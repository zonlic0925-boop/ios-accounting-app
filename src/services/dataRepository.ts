import { db, type Transaction, type Category, type Account, type TransactionType } from "../db";
import { currencyService, convertAmount, getRate } from "./currency";

export interface TransactionFilter {
  startDate?: string;
  endDate?: string;
  categoryId?: string;
  accountId?: string;
  type?: TransactionType;
  query?: string;
}

export interface NetWorthSummary {
  totalNetWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  baseCurrency: string;
  accountBreakdown: Array<{
    account: Account;
    originalBalance: number;
    originalCurrency: string;
    baseBalance: number;
  }>;
}

export interface TransferParams {
  fromAccountId: string;
  toAccountId: string;
  fromAmount: number;
  toAmount?: number; // If not provided, computed by exchange rate
  customExchangeRate?: number;
  fee?: number; // In fromAccount's currency
  date?: string;
  note?: string;
}

/**
 * Data Repository for Accounting App
 * Encapsulates multi-currency calculation, account balance tracking, and CRUD operations.
 */
export class DataRepository {
  /**
   * Get Current Base Currency from settings or service
   */
  public async getBaseCurrency(): Promise<string> {
    const setting = await db.settings.get("base_currency");
    if (setting && setting.value) {
      currencyService.setBaseCurrency(setting.value);
      return setting.value;
    }
    return currencyService.getBaseCurrency();
  }

  /**
   * Switch Application Base Currency
   * Re-calculates baseAmount and exchangeRate for all historical transactions, and persists setting.
   */
  public async switchBaseCurrency(newBaseCurrency: string): Promise<{ updatedCount: number; newBaseCurrency: string }> {
    const targetCode = newBaseCurrency.toUpperCase();
    currencyService.setBaseCurrency(targetCode);
    await db.settings.put({ key: "base_currency", value: targetCode });

    // Recompute all transactions base amounts with the new base currency
    const allTransactions = await db.transactions.toArray();
    let updatedCount = 0;

    await db.transaction("rw", db.transactions, async () => {
      for (const tx of allTransactions) {
        const rate = getRate(tx.currency, targetCode);
        const newBaseAmount = convertAmount(tx.amount, tx.currency, targetCode);

        tx.baseCurrency = targetCode;
        tx.exchangeRate = rate;
        tx.baseAmount = newBaseAmount;
        tx.updatedAt = Date.now();

        await db.transactions.put(tx);
        updatedCount++;
      }
    });

    return { updatedCount, newBaseCurrency: targetCode };
  }

  /**
   * Add a New Transaction with Automatic Multi-Currency Conversion and Account Balance Updates
   */
  public async createTransaction(
    input: Omit<Transaction, "id" | "baseAmount" | "baseCurrency" | "exchangeRate" | "createdAt" | "updatedAt"> & {
      baseCurrency?: string;
      exchangeRate?: number;
      baseAmount?: number;
    }
  ): Promise<number> {
    const baseCur = input.baseCurrency || (await this.getBaseCurrency());
    const rate = input.exchangeRate || getRate(input.currency, baseCur);
    const baseAmt =
      typeof input.baseAmount === "number"
        ? input.baseAmount
        : convertAmount(input.amount, input.currency, baseCur);

    const now = Date.now();
    const transactionRecord: Transaction = {
      ...input,
      currency: input.currency.toUpperCase(),
      baseCurrency: baseCur,
      exchangeRate: rate,
      baseAmount: baseAmt,
      createdAt: now,
      updatedAt: now,
    };

    return await db.transaction("rw", [db.transactions, db.accounts], async () => {
      const id = await db.transactions.add(transactionRecord);

      // Adjust account balance
      const account = await db.accounts.get(input.accountId);
      if (account) {
        // Convert transaction amount into account's native currency
        const accountAmount = convertAmount(input.amount, input.currency, account.currency);
        if (input.type === "expense") {
          account.balance = Number((account.balance - accountAmount).toFixed(2));
        } else if (input.type === "income") {
          account.balance = Number((account.balance + accountAmount).toFixed(2));
        }
        await db.accounts.put(account);
      }

      return id as number;
    });
  }

  /**
   * Update an existing transaction with balance rollback & re-application
   */
  public async updateTransaction(
    id: number,
    updates: Partial<Omit<Transaction, "id" | "createdAt">>
  ): Promise<void> {
    await db.transaction("rw", [db.transactions, db.accounts, db.settings], async () => {
      const oldTx = await db.transactions.get(id);
      if (!oldTx) throw new Error(`Transaction #${id} not found`);

      // 1. Roll back old account balance impact
      const oldAccount = await db.accounts.get(oldTx.accountId);
      if (oldAccount) {
        const oldAccountAmount = convertAmount(oldTx.amount, oldTx.currency, oldAccount.currency);
        if (oldTx.type === "expense") {
          oldAccount.balance = Number((oldAccount.balance + oldAccountAmount).toFixed(2));
        } else if (oldTx.type === "income") {
          oldAccount.balance = Number((oldAccount.balance - oldAccountAmount).toFixed(2));
        }
        await db.accounts.put(oldAccount);
      }

      // 2. Prepare new transaction data
      const mergedTx: Transaction = {
        ...oldTx,
        ...updates,
        updatedAt: Date.now(),
      };

      // Re-calculate base amount if amount or currency changed
      const baseCur = mergedTx.baseCurrency || (await this.getBaseCurrency());
      if (updates.amount !== undefined || updates.currency !== undefined || !mergedTx.baseAmount) {
        mergedTx.exchangeRate = updates.exchangeRate || getRate(mergedTx.currency, baseCur);
        mergedTx.baseAmount = convertAmount(mergedTx.amount, mergedTx.currency, baseCur);
        mergedTx.baseCurrency = baseCur;
      }

      await db.transactions.put(mergedTx);

      // 3. Apply new account balance impact
      const newAccount = await db.accounts.get(mergedTx.accountId);
      if (newAccount) {
        const newAccountAmount = convertAmount(mergedTx.amount, mergedTx.currency, newAccount.currency);
        if (mergedTx.type === "expense") {
          newAccount.balance = Number((newAccount.balance - newAccountAmount).toFixed(2));
        } else if (mergedTx.type === "income") {
          newAccount.balance = Number((newAccount.balance + newAccountAmount).toFixed(2));
        }
        await db.accounts.put(newAccount);
      }
    });
  }

  /**
   * Delete a transaction and rollback account balance
   */
  public async deleteTransaction(id: number): Promise<void> {
    await db.transaction("rw", [db.transactions, db.accounts], async () => {
      const tx = await db.transactions.get(id);
      if (!tx) return;

      const account = await db.accounts.get(tx.accountId);
      if (account) {
        const accountAmount = convertAmount(tx.amount, tx.currency, account.currency);
        if (tx.type === "expense") {
          account.balance = Number((account.balance + accountAmount).toFixed(2));
        } else if (tx.type === "income") {
          account.balance = Number((account.balance - accountAmount).toFixed(2));
        }
        await db.accounts.put(account);
      }

      await db.transactions.delete(id);
    });
  }

  /**
   * Multi-Currency Account Transfer (跨币种账户划转与汇差计算)
   * Deducts from fromAccount, converts to toAccount's currency, and records transfer.
   */
  public async transferBetweenAccounts(params: TransferParams): Promise<number> {
    const { fromAccountId, toAccountId, fromAmount, fee = 0, date = new Date().toISOString().slice(0, 10), note } = params;

    if (fromAccountId === toAccountId) {
      throw new Error("Source and destination accounts must be different");
    }
    if (fromAmount <= 0) {
      throw new Error("Transfer amount must be positive");
    }

    return await db.transaction("rw", [db.transactions, db.accounts, db.settings], async () => {
      const fromAcc = await db.accounts.get(fromAccountId);
      const toAcc = await db.accounts.get(toAccountId);

      if (!fromAcc || !toAcc) {
        throw new Error("Account not found");
      }

      const baseCur = await this.getBaseCurrency();
      const rateFromTo = params.customExchangeRate || getRate(fromAcc.currency, toAcc.currency);
      const calculatedToAmount = params.toAmount !== undefined ? params.toAmount : Number((fromAmount * rateFromTo).toFixed(2));

      // Deduct from source
      const totalFromDeduction = fromAmount + fee;
      fromAcc.balance = Number((fromAcc.balance - totalFromDeduction).toFixed(2));
      await db.accounts.put(fromAcc);

      // Add to destination
      toAcc.balance = Number((toAcc.balance + calculatedToAmount).toFixed(2));
      await db.accounts.put(toAcc);

      // Record transfer transaction
      const baseAmount = convertAmount(fromAmount, fromAcc.currency, baseCur);
      const now = Date.now();

      const txRecord: Transaction = {
        title: `转账: ${fromAcc.name} ➔ ${toAcc.name}`,
        amount: fromAmount,
        currency: fromAcc.currency,
        baseAmount: baseAmount,
        baseCurrency: baseCur,
        exchangeRate: getRate(fromAcc.currency, baseCur),
        type: "transfer",
        categoryId: "transfer",
        categoryName: "账户互转",
        categoryIcon: "ArrowRightLeft",
        categoryColor: "#5856D6",
        accountId: fromAccountId,
        targetAccountId: toAccountId,
        date: date,
        note: note || (fromAcc.currency !== toAcc.currency ? `汇率: 1 ${fromAcc.currency} = ${rateFromTo} ${toAcc.currency}` : undefined),
        createdAt: now,
        updatedAt: now,
      };

      const txId = await db.transactions.add(txRecord);
      return txId as number;
    });
  }

  /**
   * Filter and Query Transactions
   */
  public async getTransactions(filter?: TransactionFilter): Promise<Transaction[]> {
    let collection = db.transactions.orderBy("date").reverse();

    let items = await collection.toArray();

    if (filter) {
      if (filter.startDate) {
        items = items.filter((t) => t.date >= filter.startDate!);
      }
      if (filter.endDate) {
        items = items.filter((t) => t.date <= filter.endDate!);
      }
      if (filter.categoryId) {
        items = items.filter((t) => t.categoryId === filter.categoryId);
      }
      if (filter.accountId) {
        items = items.filter((t) => t.accountId === filter.accountId || t.targetAccountId === filter.accountId);
      }
      if (filter.type) {
        items = items.filter((t) => t.type === filter.type);
      }
      if (filter.query) {
        const q = filter.query.toLowerCase();
        items = items.filter(
          (t) =>
            t.title?.toLowerCase().includes(q) ||
            t.note?.toLowerCase().includes(q) ||
            t.categoryName?.toLowerCase().includes(q) ||
            t.tags?.some((tag) => tag.toLowerCase().includes(q))
        );
      }
    }

    return items;
  }

  /**
   * Get Transaction by ID
   */
  public async getTransactionById(id: number): Promise<Transaction | undefined> {
    return await db.transactions.get(id);
  }

  /**
   * Calculate Aggregated Net Worth in specified or base currency
   */
  public async getTotalNetWorth(targetCurrency?: string): Promise<NetWorthSummary> {
    const baseCur = targetCurrency ? targetCurrency.toUpperCase() : await this.getBaseCurrency();
    const accounts = await db.accounts.toArray();

    let totalNetWorth = 0;
    let totalAssets = 0;
    let totalLiabilities = 0;

    const breakdown = accounts.map((acc) => {
      const baseBalance = convertAmount(acc.balance, acc.currency, baseCur);
      totalNetWorth += baseBalance;

      if (baseBalance >= 0) {
        totalAssets += baseBalance;
      } else {
        totalLiabilities += Math.abs(baseBalance);
      }

      return {
        account: acc,
        originalBalance: acc.balance,
        originalCurrency: acc.currency,
        baseBalance: Number(baseBalance.toFixed(2)),
      };
    });

    return {
      totalNetWorth: Number(totalNetWorth.toFixed(2)),
      totalAssets: Number(totalAssets.toFixed(2)),
      totalLiabilities: Number(totalLiabilities.toFixed(2)),
      baseCurrency: baseCur,
      accountBreakdown: breakdown,
    };
  }

  /**
   * Accounts Management
   */
  public async getAccounts(): Promise<Account[]> {
    return await db.accounts.toArray();
  }

  public async getAccountById(id: string): Promise<Account | undefined> {
    return await db.accounts.get(id);
  }

  public async createAccount(account: Account): Promise<string> {
    const accWithDefaults: Account = {
      ...account,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.accounts.put(accWithDefaults);
    return account.id;
  }

  public async updateAccount(id: string, updates: Partial<Account>): Promise<void> {
    const acc = await db.accounts.get(id);
    if (!acc) throw new Error(`Account ${id} not found`);
    await db.accounts.put({
      ...acc,
      ...updates,
      updatedAt: Date.now(),
    });
  }

  public async deleteAccount(id: string): Promise<void> {
    await db.accounts.delete(id);
  }

  /**
   * Categories Management
   */
  public async getCategories(type?: TransactionType): Promise<Category[]> {
    let cats = await db.categories.toArray();
    if (type) {
      cats = cats.filter((c) => c.type === type);
    }
    return cats.sort((a, b) => (a.sortOrder || 999) - (b.sortOrder || 999));
  }

  public async createCategory(cat: Category): Promise<string> {
    await db.categories.put(cat);
    return cat.id;
  }

  public async updateCategory(id: string, updates: Partial<Category>): Promise<void> {
    const cat = await db.categories.get(id);
    if (!cat) throw new Error(`Category ${id} not found`);
    await db.categories.put({ ...cat, ...updates });
  }

  public async deleteCategory(id: string): Promise<void> {
    await db.categories.delete(id);
  }

  /**
   * Settings Management
   */
  public async getSetting<T>(key: string, defaultValue: T): Promise<T> {
    const item = await db.settings.get(key);
    return item ? (item.value as T) : defaultValue;
  }

  public async setSetting<T>(key: string, value: T): Promise<void> {
    await db.settings.put({ key, value });
  }

  /**
   * Export all data as CSV string
   */
  public async exportCSV(): Promise<string> {
    const txs = await db.transactions.toArray();
    const headers = [
      "ID",
      "Type",
      "Amount",
      "Currency",
      "BaseAmount",
      "BaseCurrency",
      "ExchangeRate",
      "Category",
      "Account",
      "Date",
      "Note",
    ];

    const rows = txs.map((tx) => [
      tx.id || "",
      tx.type,
      tx.amount,
      tx.currency,
      tx.baseAmount,
      tx.baseCurrency,
      tx.exchangeRate,
      `"${(tx.categoryName || tx.categoryId || "").replace(/"/g, '""')}"`,
      `"${(tx.accountId || "").replace(/"/g, '""')}"`,
      tx.date,
      `"${(tx.note || "").replace(/"/g, '""')}"`,
    ]);

    return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  }

  /**
   * Import data from CSV string
   */
  public async importCSV(csvContent: string): Promise<number> {
    const lines = csvContent.trim().split("\n");
    if (lines.length <= 1) return 0;

    let importedCount = 0;
    const baseCur = await this.getBaseCurrency();

    // Simple CSV parser supporting quotes
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const regex = /(?:,"|^")(""|[\w\W]*?)(?=",|"$)|(?:,(?!")|^(?!"))([^,]*?)(?=$|,)|(\r\n|\n)/g;
      const matches: string[] = [];
      let match;
      while ((match = regex.exec(line)) !== null) {
        if (match[1] !== undefined) {
          matches.push(match[1].replace(/""/g, '"'));
        } else if (match[2] !== undefined) {
          matches.push(match[2]);
        }
      }

      if (matches.length >= 8) {
        const type = (matches[1] || "expense") as TransactionType;
        const amount = parseFloat(matches[2]) || 0;
        const currency = matches[3] || baseCur;
        const category = matches[7] || "餐饮";
        const account = matches[8] || "默认账户";
        const date = matches[9] || new Date().toISOString().split("T")[0];
        const note = matches[10] || "";

        const rate = currencyService.getRate(currency, baseCur);
        const baseAmount = amount * rate;

        await db.transactions.add({
          title: category,
          type,
          amount,
          currency,
          baseAmount,
          baseCurrency: baseCur,
          exchangeRate: rate,
          categoryId: category,
          categoryName: category,
          accountId: account,
          date,
          note,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        importedCount++;
      }
    }

    return importedCount;
  }

  /**
   * Reset all database collections
   */
  public async resetAllData(): Promise<void> {
    await db.transactions.clear();
    await db.accounts.clear();
    await db.categories.clear();
    await db.settings.clear();
    // Re-initialize default seeds
    const { initializeDatabase } = await import("../db");
    await initializeDatabase();
  }
}

export const repository = new DataRepository();
