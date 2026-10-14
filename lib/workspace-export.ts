import type { bakeryProfiles, budgets, commitments, events, expenses, payments } from "../db/schema";

type EventRow = typeof events.$inferSelect;
type BudgetRow = typeof budgets.$inferSelect;
type CommitmentRow = typeof commitments.$inferSelect;
type ExpenseRow = typeof expenses.$inferSelect;
type PaymentRow = typeof payments.$inferSelect;
type ProfileRow = typeof bakeryProfiles.$inferSelect;

export type WorkspaceRows = {
  events: EventRow[];
  budgets: BudgetRow[];
  commitments: CommitmentRow[];
  expenses: ExpenseRow[];
  payments: PaymentRow[];
  bakeryProfile: ProfileRow | null;
};

export function buildWorkspaceExport(rows: WorkspaceRows, exportedAt: string) {
  const ids = new Set(rows.events.map((event) => event.id));
  const group = <T extends { eventId: string }>(items: T[]) => {
    const byEvent = new Map<string, T[]>();
    for (const item of items) {
      if (!ids.has(item.eventId)) continue;
      const group = byEvent.get(item.eventId) ?? [];
      group.push(item);
      byEvent.set(item.eventId, group);
    }
    return byEvent;
  };
  const plans = group(rows.budgets);
  const vendorPlans = group(rows.commitments);
  const costs = group(rows.expenses);
  const received = group(rows.payments);
  const { ownerId: _profileOwnerId, ...bakeryProfile } = rows.bakeryProfile ?? { ownerId: "", businessName: "", phone: "", email: "", instagram: "", logoDataUrl: "", updatedAt: "" };

  return {
    format: "event-profit-watch-workspace",
    version: 1,
    exportedAt,
    bakeryProfile: rows.bakeryProfile ? bakeryProfile : null,
    records: rows.events.map(({ ownerId: _ownerId, ...event }) => ({
      ...event,
      budgets: plans.get(event.id) ?? [],
      commitments: vendorPlans.get(event.id) ?? [],
      expenses: costs.get(event.id) ?? [],
      payments: received.get(event.id) ?? [],
    })),
  };
}
