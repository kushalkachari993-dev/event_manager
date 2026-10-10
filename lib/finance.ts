export const CATEGORIES = ["Flowers", "Materials", "Labour", "Rentals", "Transport", "Other"] as const;
export type Category = (typeof CATEGORIES)[number];

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && CATEGORIES.includes(value as Category);
}

export function toPaise(value: unknown): number | null {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount) || amount < 0 || amount > 100_000_000) return null;
  return Math.round(amount * 100);
}

export type EventRecord = {
  id: string;
  name: string;
  client: string;
  eventDate: string;
  quotePaise: number;
  createdAt: string;
  archivedAt: string | null;
  budgets: { category: Category; plannedPaise: number }[];
  expenses: { id: string; category: Category; description: string; amountPaise: number; spentOn: string }[];
};

export function metrics(event: EventRecord) {
  const planned = event.budgets.reduce((sum, row) => sum + row.plannedPaise, 0);
  const spent = event.expenses.reduce((sum, row) => sum + row.amountPaise, 0);
  const projectedCost = CATEGORIES.reduce((sum, category) => {
    const budget = event.budgets.find((row) => row.category === category)?.plannedPaise ?? 0;
    const actual = event.expenses.filter((row) => row.category === category).reduce((n, row) => n + row.amountPaise, 0);
    return sum + Math.max(budget, actual);
  }, 0);
  const projectedProfit = event.quotePaise - projectedCost;
  return { planned, spent, projectedCost, projectedProfit, margin: event.quotePaise ? Math.round((projectedProfit / event.quotePaise) * 100) : 0 };
}
