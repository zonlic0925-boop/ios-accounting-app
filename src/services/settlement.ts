/**
 * Couples Shared Ledger settlement engine (pure, no IO).
 *
 * Ownership model: a shared record belongs to whoever recorded it — recording
 * equals paying. Both partners equally split the total expense; settlement
 * transfers shift each side's share basis so the balance can close at zero.
 * Extracted as pure functions so both devices' perspectives can be unit-tested
 * against the same scenario matrix.
 */

/** Minimal shape of a settled (non-deleted) shared-ledger transaction. */
export interface SettlementTxLike {
  type: string;
  baseAmount?: number;
  categoryId?: string;
  /** Recorder's device key — recording equals paying. */
  ownerId?: string;
  /** On a settlement transfer: who handed the money over, relative to the record's creator. */
  settlementBy?: "me" | "partner";
}

export interface SharedTotals {
  totalSharedExpense: number;
  totalPaidByMe: number;
  totalPaidByPartner: number;
  /** Settlement money I received; raises my share basis so I can owe exactly zero after repaying. */
  myShareAdjustment: number;
}

export interface SettlementVerdict {
  myTotalShare: number;
  partnerTotalShare: number;
  /** > 0: partner owes me; < 0: I owe partner. */
  netBalance: number;
  payerOwesWhom: "partner_owes_me" | "i_owe_partner" | "settled";
  owesAmount: number;
}

export function foldSharedTotals(
  txs: SettlementTxLike[],
  isMine: (tx: SettlementTxLike) => boolean
): SharedTotals {
  const totals: SharedTotals = {
    totalSharedExpense: 0,
    totalPaidByMe: 0,
    totalPaidByPartner: 0,
    myShareAdjustment: 0,
  };

  for (const tx of txs) {
    if (tx.type === "expense") {
      totals.totalSharedExpense += tx.baseAmount ?? 0;
      if (isMine(tx)) {
        totals.totalPaidByMe += tx.baseAmount ?? 0;
      } else {
        totals.totalPaidByPartner += tx.baseAmount ?? 0;
      }
    } else if (tx.type === "transfer" && tx.categoryId === "settlement") {
      // settlementBy names who handed the money over, relative to the creator.
      // Giver: paid count rises. Receiver: share basis rises. Both devices must land on the same side.
      const iAmCreator = isMine(tx);
      const creatorGave = tx.settlementBy ? tx.settlementBy === "me" : iAmCreator;
      const iGave = iAmCreator ? creatorGave : !creatorGave;
      if (iGave) {
        totals.totalPaidByMe += tx.baseAmount ?? 0;
      } else {
        totals.myShareAdjustment += tx.baseAmount ?? 0;
      }
    }
  }

  return totals;
}

export function classifySettlement(totals: SharedTotals): SettlementVerdict {
  // Each side owes half of the total; whoever paid more is owed the difference
  const half = totals.totalSharedExpense / 2;
  const myTotalShare = half + totals.myShareAdjustment;
  const partnerTotalShare = half;

  const netBalance = Number((totals.totalPaidByMe - myTotalShare).toFixed(2));
  const owesAmount = Math.abs(netBalance);

  let payerOwesWhom: SettlementVerdict["payerOwesWhom"] = "settled";
  if (netBalance > 0.05) {
    payerOwesWhom = "partner_owes_me";
  } else if (netBalance < -0.05) {
    payerOwesWhom = "i_owe_partner";
  }

  return {
    myTotalShare: Number(myTotalShare.toFixed(2)),
    partnerTotalShare: Number(partnerTotalShare.toFixed(2)),
    netBalance,
    payerOwesWhom,
    owesAmount: Number(owesAmount.toFixed(2)),
  };
}
