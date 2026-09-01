import Dexie, { type Table } from "dexie";

export type TransactionType = "expense" | "income" | "transfer";
export type AccountType = "cash" | "credit" | "debit" | "investment" | "other";
export type LedgerId = "personal" | "shared";

export interface Transaction {
  id?: number;
  remoteId?: string;          // 云端分布式全局唯一ID (Distributed UUID for cross-device sync)
  ledgerId?: LedgerId;        // 账本隔离ID: 'personal' (个人私密) | 'shared' (恋爱共享)
  ownerId?: string;           // 共享账本归属: 记录创建者的设备 ownerKey (谁记的即谁出的)
  ownerName?: string;         // 记账人当时的称呼快照 (便于云端查看)
  settlementBy?: "me" | "partner"; // 仅结算记录使用: 相对记录创建者, 谁交付的这笔款
  syncStatus?: "synced" | "pending"; // 云端同步状态: 'synced' | 'pending'
  deletedAt?: number;         // 软删除时间戳: 非空表示已删除, 删除操作随云端同步, 对端据此清理副本
  title: string;
  amount: number;             // 原始金额 (Original amount)
  currency: string;           // 交易币种 (Transaction currency code, e.g. "USD", "JPY", "CNY")
  baseAmount: number;         // 折算为主币种金额 (Amount converted to base currency)
  baseCurrency: string;       // 记账时的主币种代码 (Base currency code, e.g. "CNY")
  exchangeRate: number;       // 记账时汇率 (1 currency = X baseCurrency)
  type: TransactionType;      // 'expense' | 'income' | 'transfer'
  categoryId: string;         // 分类ID
  categoryName?: string;      // 冗余存储分类名称便于展示
  categoryIcon?: string;      // 冗余存储图标
  categoryColor?: string;     // 冗余存储颜色
  accountId: string;          // 扣款/入账账户ID
  targetAccountId?: string;   // 目标账户ID (仅转账时使用)
  date: string;               // 记账日期 (YYYY-MM-DD or full ISO)
  note?: string;              // 备注
  tags?: string[];            // 可选标签数组
  createdAt: number;          // 创建时间戳
  updatedAt: number;          // 更新时间戳
}

export interface Category {
  id: string;
  name: string;
  type: "expense" | "income";
  icon: string;
  color: string;
  isCustom?: boolean;
  sortOrder?: number;
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  currency: string;           // 账户币种 (e.g. "CNY", "USD", "EUR")
  balance: number;            // 当前账户余额
  icon: string;
  color: string;
  isDefault?: boolean;
  description?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface SettingItem {
  key: string;
  value: any;
}

/**
 * Enhanced IndexedDB Storage with Dexie
 */
export class FinanceDatabase extends Dexie {
  transactions!: Table<Transaction, number>;
  categories!: Table<Category, string>;
  accounts!: Table<Account, string>;
  settings!: Table<SettingItem, string>;

  constructor() {
    super("FinanceDB");
    
    // Schema definition with primary keys and indexed fields
    this.version(1).stores({
      transactions: "++id, type, categoryId, accountId, date, createdAt",
      categories: "id, type",
      accounts: "id, type",
    });

    // Version 2: Complete multi-currency expansion & setting store
    this.version(2).stores({
      transactions: "++id, title, type, currency, baseCurrency, categoryId, accountId, targetAccountId, date, createdAt, updatedAt",
      categories: "id, type, sortOrder",
      accounts: "id, type, currency, isDefault",
      settings: "key",
    }).upgrade(async (tx) => {
      // Data upgrade if upgrading from v1
      const defaultBase = "CNY";
      const transTable = tx.table<Transaction, number>("transactions");
      const trans = await transTable.toArray();
      for (const t of trans) {
        if (!t.currency) t.currency = defaultBase;
        if (!t.baseCurrency) t.baseCurrency = defaultBase;
        if (!t.baseAmount) t.baseAmount = t.amount;
        if (!t.exchangeRate) t.exchangeRate = 1.0;
        if (!t.title) t.title = t.categoryName || "账目支出";
        if (!t.updatedAt) t.updatedAt = t.createdAt || Date.now();
        await transTable.put(t);
      }

      const accTable = tx.table<Account, string>("accounts");
      const accs = await accTable.toArray();
      for (const a of accs) {
        if (!a.currency) a.currency = defaultBase;
        await accTable.put(a);
      }
    });

    // Version 3: Shared Couple Ledger, Payer, Split Rule & Sync Status
    this.version(3).stores({
      transactions: "++id, remoteId, ledgerId, payer, syncStatus, title, type, currency, baseCurrency, categoryId, accountId, targetAccountId, date, createdAt, updatedAt",
      categories: "id, type, sortOrder",
      accounts: "id, type, currency, isDefault",
      settings: "key",
    }).upgrade(async (tx) => {
      type LegacyTx = Transaction & { payer?: string; splitRule?: string; myShareAmount?: number };
      const transTable = tx.table<LegacyTx, number>("transactions");
      const trans = await transTable.toArray();
      for (const t of trans) {
        if (!t.ledgerId) t.ledgerId = "personal";
        if (!t.payer) t.payer = "me";
        if (!t.splitRule) t.splitRule = "100_me";
        if (t.myShareAmount === undefined) t.myShareAmount = t.baseAmount;
        if (!t.syncStatus) t.syncStatus = "synced";
        if (!t.remoteId) t.remoteId = `tx_${t.id || Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        await transTable.put(t);
      }
    });

    // Version 4: Ownership model — who recorded it paid it; drop payer/split rules
    this.version(4).stores({
      transactions: "++id, remoteId, ledgerId, ownerId, syncStatus, title, type, currency, baseCurrency, categoryId, accountId, targetAccountId, date, createdAt, updatedAt",
      categories: "id, type, sortOrder",
      accounts: "id, type, currency, isDefault",
      settings: "key",
    }).upgrade(async (tx) => {
      type LegacyTx = Transaction & { payer?: string; splitRule?: string; myShareAmount?: number };
      const transTable = tx.table<LegacyTx, number>("transactions");
      const trans = await transTable.toArray();
      for (const legacy of trans) {
        // Old "payer" choice becomes hard ownership: the record creator paid it.
        // If the user previously logged a partner-paid item, it still belongs to the partner.
        if (legacy.ledgerId === "shared") {
          if (legacy.payer === "partner" && legacy.splitRule === "100_partner") {
            legacy.ownerId = "partner";
          } else {
            legacy.ownerId = getDeviceOwnerKey();
          }
        } else {
          legacy.ownerId = undefined;
        }
        delete legacy.payer;
        delete legacy.splitRule;
        delete legacy.myShareAmount;
        await transTable.put(legacy);
      }
    });
  }
}

export const db = new FinanceDatabase();

/**
 * Per-device identity for shared-ledger ownership. Lives here so the Dexie
 * v4 migration and the sync service resolve the exact same ownerKey —
 * legacy records stamped "me" must match the device's real key.
 */
export function getDeviceOwnerKey(): string {
  const STORAGE = "ios_finance_owner_key";
  let key = localStorage.getItem(STORAGE);
  if (!key) {
    key = `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(STORAGE, key);
  }
  return key;
}

/**
 * Standard Preset Expense Categories with Modern Lucide Icons and iOS Harmonized Colors
 */
export const DEFAULT_EXPENSE_CATEGORIES: Category[] = [
  { id: "cat_food", name: "餐饮美食", type: "expense", icon: "Utensils", color: "#FF9500", sortOrder: 1, isCustom: false },
  { id: "cat_shopping", name: "购物消费", type: "expense", icon: "ShoppingBag", color: "#FF2D55", sortOrder: 2, isCustom: false },
  { id: "cat_transport", name: "交通出行", type: "expense", icon: "Car", color: "#007AFF", sortOrder: 3, isCustom: false },
  { id: "cat_entertainment", name: "休闲娱乐", type: "expense", icon: "Gamepad2", color: "#AF52DE", sortOrder: 4, isCustom: false },
  { id: "cat_housing", name: "居家生活", type: "expense", icon: "Home", color: "#5856D6", sortOrder: 5, isCustom: false },
  { id: "cat_medical", name: "医疗保健", type: "expense", icon: "HeartPulse", color: "#FF3B30", sortOrder: 6, isCustom: false },
  { id: "cat_digital", name: "数码科技", type: "expense", icon: "Smartphone", color: "#5AC8FA", sortOrder: 7, isCustom: false },
  { id: "cat_learning", name: "学习深造", type: "expense", icon: "GraduationCap", color: "#34C759", sortOrder: 8, isCustom: false },
  { id: "cat_social", name: "人情社交", type: "expense", icon: "Users", color: "#FF6482", sortOrder: 9, isCustom: false },
  { id: "cat_travel", name: "旅游度假", type: "expense", icon: "Plane", color: "#30B0C7", sortOrder: 10, isCustom: false },
  { id: "cat_groceries", name: "日用百货", type: "expense", icon: "ShoppingCart", color: "#FF9F0A", sortOrder: 11, isCustom: false },
];

/**
 * Standard Preset Income Categories
 */
export const DEFAULT_INCOME_CATEGORIES: Category[] = [
  { id: "cat_salary", name: "工资薪酬", type: "income", icon: "Wallet", color: "#34C759", sortOrder: 1, isCustom: false },
  { id: "cat_bonus", name: "奖金津贴", type: "income", icon: "Gift", color: "#FFCC00", sortOrder: 2, isCustom: false },
  { id: "cat_investment", name: "投资理财", type: "income", icon: "TrendingUp", color: "#5AC8FA", sortOrder: 3, isCustom: false },
  { id: "cat_freelance", name: "兼职副业", type: "income", icon: "Laptop", color: "#AF52DE", sortOrder: 4, isCustom: false },
  { id: "cat_redpacket", name: "人情红包", type: "income", icon: "Sparkles", color: "#FF2D55", sortOrder: 5, isCustom: false },
  { id: "cat_other_income", name: "其他收入", type: "income", icon: "CircleDollarSign", color: "#8E8E93", sortOrder: 6, isCustom: false },
];

export const DEFAULT_CATEGORIES: Category[] = [
  ...DEFAULT_EXPENSE_CATEGORIES,
  ...DEFAULT_INCOME_CATEGORIES,
];

/**
 * Preset Accounts including Multi-Currency Support
 */
export const DEFAULT_ACCOUNTS: Account[] = [
  {
    id: "acc_cash",
    name: "现金钱包",
    type: "cash",
    currency: "CNY",
    balance: 0.0,
    icon: "Banknote",
    color: "#34C759",
    isDefault: false,
    description: "随身日常零钱",
  },
  {
    id: "acc_wechat",
    name: "微信支付",
    type: "debit",
    currency: "CNY",
    balance: 0.0,
    icon: "MessageCircle",
    color: "#07C160",
    isDefault: true,
    description: "微信零钱及零钱通",
  },
  {
    id: "acc_alipay",
    name: "支付宝",
    type: "debit",
    currency: "CNY",
    balance: 0.0,
    icon: "Zap",
    color: "#1677FF",
    isDefault: false,
    description: "余额宝及绑卡快捷支付",
  },
  {
    id: "acc_cmb",
    name: "招商银行储蓄卡",
    type: "debit",
    currency: "CNY",
    balance: 0.0,
    icon: "CreditCard",
    color: "#EA1D2C",
    isDefault: false,
    description: "主薪资与日常储蓄卡",
  },
  {
    id: "acc_visa",
    name: "多币种Visa信用卡",
    type: "credit",
    currency: "USD",
    balance: 0.0,
    icon: "Globe",
    color: "#1A1F71",
    isDefault: false,
    description: "海淘、出境游及外币线上订阅",
  },
];

/**
 * Initial Multi-Currency Sample Transactions - Purged for clean initial state
 */
export const DEFAULT_SAMPLE_TRANSACTIONS: Omit<Transaction, "id">[] = [];

/**
 * Initialize Database with default presets if empty
 */
export async function initializeDatabase(force: boolean = false): Promise<void> {
  const isInitialized = await db.settings.get("is_initialized_v2");
  if (isInitialized && !force) {
    return;
  }

  // Populate categories if none exist
  const catCount = await db.categories.count();
  if (catCount === 0 || force) {
    if (force) await db.categories.clear();
    await db.categories.bulkPut(DEFAULT_CATEGORIES);
  }

  // Populate accounts if none exist
  const accCount = await db.accounts.count();
  if (accCount === 0 || force) {
    if (force) await db.accounts.clear();
    await db.accounts.bulkPut(DEFAULT_ACCOUNTS);
  }

  // Populate settings
  const baseCurrencySetting = await db.settings.get("base_currency");
  if (!baseCurrencySetting || force) {
    await db.settings.put({ key: "base_currency", value: "CNY" });
  }

  const autoSyncSetting = await db.settings.get("auto_sync_rates");
  if (!autoSyncSetting || force) {
    await db.settings.put({ key: "auto_sync_rates", value: true });
  }

  const themeSetting = await db.settings.get("theme_mode");
  if (!themeSetting || force) {
    await db.settings.put({ key: "theme_mode", value: "system" });
  }

  // Clear demo transactions so user starts with a completely clean book
  if (!isInitialized || force) {
    await db.transactions.clear();
  }

  await db.settings.put({ key: "is_initialized_v2", value: true });
}
