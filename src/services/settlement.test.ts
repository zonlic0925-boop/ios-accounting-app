/**
 * 结算引擎单元测试 — 模拟真实情侣场景矩阵。
 * 运行方式（无测试框架，esbuild 打包后 node 执行）：
 *   npx esbuild src/services/settlement.test.ts --bundle --platform=node --format=esm --outfile=node_modules/.cache/settlement.test.mjs && node node_modules/.cache/settlement.test.mjs
 *
 * 每个场景都从「阿龙」和「小熙」两台设备（ownerKey 视角）分别断言，
 * 因为同一份账在两个人手机上必须得出互为镜像且一致的结论。
 */
import { strict as assert } from "node:assert";
import { foldSharedTotals, classifySettlement, type SettlementTxLike } from "./settlement";

const DRAGON = "device-key-dragon"; // 阿龙
const XI = "device-key-xi"; // 小熙

interface DbTx extends SettlementTxLike {
  ownerId?: string;
  id?: number;
}

function view(txs: DbTx[], viewerKey: string) {
  const totals = foldSharedTotals(txs, (tx) => tx.ownerId === viewerKey);
  return { totals, verdict: classifySettlement(totals) };
}

function expense(ownerId: string, baseAmount: number): DbTx {
  return { type: "expense", baseAmount, ownerId };
}

function settlementTx(recorderId: string, settlementBy: "me" | "partner", baseAmount: number): DbTx {
  return { type: "transfer", categoryId: "settlement", settlementBy, baseAmount, ownerId: recorderId };
}

let passed = 0;
const failures: string[] = [];
function scenario(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  PASS ${name}`);
  } catch (e) {
    failures.push(name);
    console.error(`  FAIL ${name}\n       ${e instanceof Error ? e.message : e}`);
  }
}

console.log("情侣共享账本 · 结算引擎场景矩阵\n");

// ── 场景 1：用户上报 bug 的原始场景（回归锚点）──────────────────────────
// 阿龙付了 ¥8，小熙付了 ¥520，总额 528，各担 264 → 阿龙少付 256，该补给小熙
scenario("1. 截图回归：阿龙¥8/小熙¥520 → 阿龙视角=我少付256该给小熙，且归属金额正确", () => {
  const txs = [expense(DRAGON, 8), expense(XI, 520)];
  const d = view(txs, DRAGON);
  assert.equal(d.totals.totalSharedExpense, 528);
  assert.equal(d.totals.totalPaidByMe, 8);
  assert.equal(d.totals.totalPaidByPartner, 520);
  assert.equal(d.verdict.payerOwesWhom, "i_owe_partner"); // 我欠对方，绝不能显示“你多付了”
  assert.equal(d.verdict.owesAmount, 256);
  const x = view(txs, XI);
  assert.equal(x.totals.totalPaidByMe, 520);
  assert.equal(x.totals.totalPaidByPartner, 8);
  assert.equal(x.verdict.payerOwesWhom, "partner_owes_me"); // 小熙视角：阿龙还差 256
  assert.equal(x.verdict.owesAmount, 256);
});

// ── 场景 2：一方全付 ──────────────────────────────────────────────
scenario("2. 一方全付¥528 → 另一方各视角都欠一半 ¥264", () => {
  const txs = [expense(DRAGON, 528)];
  const d = view(txs, DRAGON);
  assert.equal(d.verdict.payerOwesWhom, "partner_owes_me");
  assert.equal(d.verdict.owesAmount, 264);
  const x = view(txs, XI);
  assert.equal(x.verdict.payerOwesWhom, "i_owe_partner");
  assert.equal(x.verdict.owesAmount, 264);
});

// ── 场景 3：刚好平 ────────────────────────────────────────────────
scenario("3. 双方各付¥264 → 两端都显示 settled", () => {
  const txs = [expense(DRAGON, 264), expense(XI, 264)];
  assert.equal(view(txs, DRAGON).verdict.payerOwesWhom, "settled");
  assert.equal(view(txs, XI).verdict.payerOwesWhom, "settled");
});

// ── 场景 4：奇数总额（出现 .5 分账）────────────────────────────────
scenario("4. 奇数总额¥527 全阿龙付 → 两端金额一致为 ¥263.50", () => {
  const txs = [expense(DRAGON, 527)];
  const d = view(txs, DRAGON);
  assert.equal(d.verdict.owesAmount, 263.5);
  assert.equal(d.verdict.payerOwesWhom, "partner_owes_me");
  const x = view(txs, XI);
  assert.equal(x.verdict.owesAmount, 263.5);
  assert.equal(x.verdict.payerOwesWhom, "i_owe_partner");
});

// ── 场景 5：多笔混合 ──────────────────────────────────────────────
scenario("5. 阿龙3笔共¥60 + 小熙1笔¥100 → 阿龙补 ¥20", () => {
  const txs = [expense(DRAGON, 10), expense(DRAGON, 20), expense(DRAGON, 30), expense(XI, 100)];
  const d = view(txs, DRAGON);
  assert.equal(d.totals.totalSharedExpense, 160);
  assert.equal(d.verdict.payerOwesWhom, "i_owe_partner");
  assert.equal(d.verdict.owesAmount, 20);
  const x = view(txs, XI);
  assert.equal(x.verdict.payerOwesWhom, "partner_owes_me");
  assert.equal(x.verdict.owesAmount, 20);
});

// ── 场景 6：共享账本里的收入不参与轧差 ──────────────────────────────
scenario("6. 加一笔¥500收入 → 轧差与“谁出的”完全不变", () => {
  const base = [expense(DRAGON, 8), expense(XI, 520)];
  const withIncome = [...base, { type: "income", baseAmount: 500, ownerId: XI } as DbTx];
  const a = view(base, DRAGON).verdict;
  const b = view(withIncome, DRAGON);
  assert.deepEqual(b.verdict, a);
  assert.equal(b.totals.totalPaidByPartner, 520); // 收入不计入“她出的”
});

// ── 场景 7：欠钱方在自己手机上按“爱意对齐”（settlementBy="me"）─────────
scenario("7. 阿龙(欠方)记录结算¥256 → 两端归零；小熙再花¥100 → 反向欠¥50", () => {
  const txs: DbTx[] = [expense(DRAGON, 8), expense(XI, 520), settlementTx(DRAGON, "me", 256)];
  assert.equal(view(txs, DRAGON).verdict.payerOwesWhom, "settled");
  assert.equal(view(txs, XI).verdict.payerOwesWhom, "settled");
  txs.push(expense(XI, 100));
  const d = view(txs, DRAGON);
  assert.equal(d.verdict.payerOwesWhom, "i_owe_partner");
  assert.equal(d.verdict.owesAmount, 50);
  const x = view(txs, XI);
  assert.equal(x.verdict.payerOwesWhom, "partner_owes_me");
  assert.equal(x.verdict.owesAmount, 50);
});

// ── 场景 8：被欠方在自己手机上按“爱意对齐”（settlementBy="partner"）─────
scenario("8. 小熙(被欠方)记录结算 → 结算单标记对方转账 → 两端同样归零", () => {
  const txs: DbTx[] = [expense(DRAGON, 8), expense(XI, 520), settlementTx(XI, "partner", 256)];
  assert.equal(view(txs, DRAGON).verdict.payerOwesWhom, "settled");
  assert.equal(view(txs, XI).verdict.payerOwesWhom, "settled");
});

// ── 场景 9：删单重算 ──────────────────────────────────────────────
scenario("9. 删掉阿龙的¥8 → 变成阿龙欠 ¥260（两端一致）", () => {
  const txs = [expense(XI, 520)];
  const d = view(txs, DRAGON);
  assert.equal(d.verdict.payerOwesWhom, "i_owe_partner");
  assert.equal(d.verdict.owesAmount, 260);
  const x = view(txs, XI);
  assert.equal(x.verdict.payerOwesWhom, "partner_owes_me");
  assert.equal(x.verdict.owesAmount, 260);
});

// ── 场景 10：0.05 容差（浮点尾差不算欠钱）───────────────────────────
scenario("10. 尾差¥0.02视为默契；¥0.10才算欠", () => {
  const tiny = [expense(DRAGON, 49.98), expense(XI, 50.02)];
  assert.equal(view(tiny, DRAGON).verdict.payerOwesWhom, "settled");
  const small = [expense(DRAGON, 49.9), expense(XI, 50.1)];
  assert.equal(view(small, DRAGON).verdict.payerOwesWhom, "i_owe_partner");
  assert.equal(view(small, DRAGON).verdict.owesAmount, 0.1);
});

// ── 场景 11：结算后欠钱方向反转（真实情侣常见往返）───────────────────
scenario("11. 平账后阿龙连付¥200 → 两端一致变为小熙欠 ¥100", () => {
  const txs: DbTx[] = [expense(DRAGON, 8), expense(XI, 520), settlementTx(XI, "partner", 256), expense(DRAGON, 200)];
  const d = view(txs, DRAGON);
  assert.equal(d.verdict.payerOwesWhom, "partner_owes_me");
  assert.equal(d.verdict.owesAmount, 100);
  const x = view(txs, XI);
  assert.equal(x.verdict.payerOwesWhom, "i_owe_partner");
  assert.equal(x.verdict.owesAmount, 100);
});

// ── 场景 12：普通 transfer（非结算）不参与 ───────────────────────────
scenario("12. 普通转账记录不进轧差", () => {
  const txs: DbTx[] = [expense(DRAGON, 100), { type: "transfer", categoryId: "savings", baseAmount: 999, ownerId: XI }];
  const v = view(txs, DRAGON).verdict;
  assert.equal(v.payerOwesWhom, "partner_owes_me");
  assert.equal(v.owesAmount, 50);
});

// ── 场景 13：币种折算后按 baseAmount 轧差（港币消费记账为折算值）────────
scenario("13. 外币消费(已折算baseAmount)参与轧差", () => {
  // 阿龙记了一笔 HKD 110 ≈ CNY 100（baseAmount=100），小熙付了 CNY 300
  const txs: DbTx[] = [{ type: "expense", baseAmount: 100, ownerId: DRAGON }, expense(XI, 300)];
  const d = view(txs, DRAGON);
  assert.equal(d.totals.totalSharedExpense, 400);
  assert.equal(d.verdict.owesAmount, 100);
  assert.equal(d.verdict.payerOwesWhom, "i_owe_partner");
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.error("FAILED:", failures.join(" | "));
  process.exit(1);
}
