import { z } from "zod";
import { isCategoryFor, ORDER_STAGES } from "./finance.ts";
import { parseBakeryProfile } from "./business-profile.ts";

export const MAX_BACKUP_BYTES = 5_000_000;
const MAX_PAISE = 10_000_000_000;
const id = z.string().min(1).max(100);
const paise = z.number().int().min(0).max(MAX_PAISE);
const positivePaise = paise.refine((value) => value > 0);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value);
const timestamp = z.string().refine((value) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value);
const category = z.enum(["Flowers", "Materials", "Labour", "Rentals", "Transport", "Other", "Ingredients", "Packaging", "Delivery", "Overheads"]);

const budget = z.object({ id, eventId: id, category, plannedPaise: paise });
const commitment = z.object({ id, eventId: id, vendor: z.string().min(1).max(100), category, agreedPaise: positivePaise, dueOn: date, createdAt: timestamp });
const expense = z.object({ id, eventId: id, commitmentId: id.nullable(), category, description: z.string().min(1).max(160), amountPaise: positivePaise, spentOn: date, createdAt: timestamp });
const payment = z.object({ id, eventId: id, amountPaise: positivePaise, receivedOn: date, note: z.string().max(160), createdAt: timestamp });
const record = z.object({
  id, kind: z.enum(["event", "bakery"]), orderStatus: z.enum(ORDER_STAGES),
  orderDescription: z.string().max(1000), quantity: z.number().int().min(1).max(999),
  fulfillment: z.enum(["pickup", "delivery"]), fulfillmentTime: z.string().refine((value) => value === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(value)),
  depositRequiredPaise: paise, targetMarginPct: z.number().int().min(0).max(100),
  name: z.string().min(1).max(100), client: z.string().max(100), eventDate: date,
  quotePaise: positivePaise, createdAt: timestamp, archivedAt: timestamp.nullable(),
  budgets: z.array(budget), commitments: z.array(commitment), expenses: z.array(expense), payments: z.array(payment),
}).refine((value) => value.depositRequiredPaise <= value.quotePaise);
const profile = z.object({
  businessName: z.string().max(100), phone: z.string().max(40), email: z.string().max(160), instagram: z.string().max(80),
  logoDataUrl: z.string().max(120_000), updatedAt: timestamp,
}).refine((value) => parseBakeryProfile(value) !== null);
const backupSchema = z.object({
  format: z.literal("event-profit-watch-workspace"), version: z.literal(1),
  exportedAt: timestamp, bakeryProfile: profile.nullable(), records: z.array(record),
});

export type WorkspaceBackup = z.infer<typeof backupSchema>;
export type RestoreCounts = { events: number; orders: number; budgets: number; commitments: number; expenses: number; payments: number };
export type RestoreSummary = {
  exportedAt: string;
  inFile: RestoreCounts;
  toAdd: RestoreCounts;
  alreadyPresent: RestoreCounts;
  profile: "restore" | "keep-existing" | "none";
};
export type ExistingRestoreRows = {
  events: Map<string, { ownerId: string; kind: string }>;
  budgets: Map<string, string>;
  commitments: Map<string, string>;
  expenses: Map<string, string>;
  payments: Map<string, string>;
  hasProfile: boolean;
};
export type RestorePlan = {
  summary: RestoreSummary;
  records: WorkspaceBackup["records"];
  budgets: WorkspaceBackup["records"][number]["budgets"];
  commitments: WorkspaceBackup["records"][number]["commitments"];
  expenses: WorkspaceBackup["records"][number]["expenses"];
  payments: WorkspaceBackup["records"][number]["payments"];
  profile: WorkspaceBackup["bakeryProfile"];
};

function emptyCounts(): RestoreCounts {
  return { events: 0, orders: 0, budgets: 0, commitments: 0, expenses: 0, payments: 0 };
}

export function parseWorkspaceBackup(value: unknown): { backup: WorkspaceBackup; error?: never } | { backup?: never; error: string } {
  const parsed = backupSchema.safeParse(value);
  if (!parsed.success) return { error: "This is not a valid Event Profit Watch version 1 backup. Check the file and try again." };
  const backup = parsed.data;
  if (backup.records.length > 1000) return { error: "This backup has too many records for one restore." };
  const seen = { events: new Set<string>(), budgets: new Set<string>(), commitments: new Set<string>(), expenses: new Set<string>(), payments: new Set<string>() };
  let childCount = 0;
  for (const item of backup.records) {
    if (seen.events.has(item.id)) return { error: "The backup contains a repeated event or order ID." };
    seen.events.add(item.id);
    const categories = new Set<string>();
    const commitmentIds = new Set(item.commitments.map((row) => row.id));
    const children = [item.budgets, item.commitments, item.expenses, item.payments];
    childCount += children.reduce((total, rows) => total + rows.length, 0);
    for (const row of item.budgets) {
      if (row.eventId !== item.id || seen.budgets.has(row.id)) return { error: "The backup has repeated or mismatched transaction IDs." };
      seen.budgets.add(row.id);
      if (!isCategoryFor(row.category, item.kind)) return { error: "The backup has a cost category in the wrong workspace." };
      if (categories.has(row.category)) return { error: "The backup repeats a budget category." };
      categories.add(row.category);
    }
    for (const row of item.commitments) {
      if (row.eventId !== item.id || seen.commitments.has(row.id)) return { error: "The backup has repeated or mismatched transaction IDs." };
      seen.commitments.add(row.id);
      if (!isCategoryFor(row.category, item.kind)) return { error: "The backup has a cost category in the wrong workspace." };
    }
    for (const row of item.expenses) {
      if (row.eventId !== item.id || seen.expenses.has(row.id)) return { error: "The backup has repeated or mismatched transaction IDs." };
      seen.expenses.add(row.id);
      if (!isCategoryFor(row.category, item.kind)) return { error: "The backup has a cost category in the wrong workspace." };
      if (row.commitmentId && !commitmentIds.has(row.commitmentId)) return { error: "The backup has a cost linked to a missing supplier commitment." };
    }
    for (const row of item.payments) {
      if (row.eventId !== item.id || seen.payments.has(row.id)) return { error: "The backup has repeated or mismatched transaction IDs." };
      seen.payments.add(row.id);
    }
  }
  if (childCount > 10_000) return { error: "This backup has too many transactions for one restore." };
  return { backup };
}

export function planWorkspaceRestore(backup: WorkspaceBackup, ownerId: string, existing: ExistingRestoreRows): RestorePlan {
  const inFile = emptyCounts();
  const toAdd = emptyCounts();
  const alreadyPresent = emptyCounts();
  const records: RestorePlan["records"] = [];
  const budgets: RestorePlan["budgets"] = [];
  const commitments: RestorePlan["commitments"] = [];
  const expenses: RestorePlan["expenses"] = [];
  const payments: RestorePlan["payments"] = [];
  function addMissing<T extends { id: string; eventId: string }>(type: "budgets" | "commitments" | "expenses" | "payments", rows: T[], destination: T[], eventId: string) {
    for (const row of rows) {
      const parent = existing[type].get(row.id);
      if (parent && parent !== eventId) throw new Error("This backup contains a transaction ID that conflicts with another record.");
      inFile[type]++;
      (parent ? alreadyPresent : toAdd)[type]++;
      if (!parent) destination.push(row);
    }
  }
  for (const item of backup.records) {
    const type = item.kind === "bakery" ? "orders" : "events";
    const found = existing.events.get(item.id);
    if (found && (found.ownerId !== ownerId || found.kind !== item.kind)) throw new Error("This backup contains a record ID that conflicts with another workspace.");
    inFile[type]++;
    (found ? alreadyPresent : toAdd)[type]++;
    if (!found) records.push(item);
    addMissing("budgets", item.budgets, budgets, item.id);
    addMissing("commitments", item.commitments, commitments, item.id);
    addMissing("expenses", item.expenses, expenses, item.id);
    addMissing("payments", item.payments, payments, item.id);
  }
  return {
    summary: { exportedAt: backup.exportedAt, inFile, toAdd, alreadyPresent, profile: backup.bakeryProfile ? existing.hasProfile ? "keep-existing" : "restore" : "none" },
    records, budgets, commitments, expenses, payments,
    profile: backup.bakeryProfile && !existing.hasProfile ? backup.bakeryProfile : null,
  };
}
