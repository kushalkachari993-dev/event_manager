export const CATEGORIES = ["Flowers", "Materials", "Labour", "Rentals", "Transport", "Other"] as const;
export const BAKERY_CATEGORIES = ["Ingredients", "Labour", "Packaging", "Delivery", "Overheads", "Other"] as const;
const ALL_CATEGORIES: readonly string[] = [...CATEGORIES, ...BAKERY_CATEGORIES];
export type BusinessKind = "event" | "bakery";
export type Fulfillment = "pickup" | "delivery";
export const ORDER_STAGES = ["enquiry", "quoted", "confirmed", "in_production", "ready", "delivered"] as const;
export type OrderStatus = (typeof ORDER_STAGES)[number];
export const ORDER_STAGE_LABELS: Record<OrderStatus, string> = {
  enquiry: "Enquiry", quoted: "Quoted", confirmed: "Confirmed",
  in_production: "In production", ready: "Ready", delivered: "Delivered",
};
export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && ORDER_STAGES.some((stage) => stage === value);
}
export type Category = (typeof CATEGORIES)[number] | (typeof BAKERY_CATEGORIES)[number];

export function categoriesFor(kind: BusinessKind): readonly Category[] {
  return kind === "bakery" ? BAKERY_CATEGORIES : CATEGORIES;
}

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && ALL_CATEGORIES.includes(value);
}

export function isCategoryFor(value: unknown, kind: BusinessKind): value is Category {
  return isCategory(value) && categoriesFor(kind).includes(value);
}

export function toPaise(value: unknown): number | null {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount) || amount < 0 || amount > 100_000_000) return null;
  return Math.round(amount * 100);
}

const wholeRupees = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const rupeesWithPaise = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatCurrency(paise: number): string {
  return (paise % 100 === 0 ? wholeRupees : rupeesWithPaise).format(paise / 100);
}

export type EventRecord = {
  id: string;
  kind: BusinessKind;
  orderStatus: OrderStatus;
  orderDescription: string;
  quantity: number;
  fulfillment: Fulfillment;
  fulfillmentTime: string;
  depositRequiredPaise: number;
  targetMarginPct: number;
  name: string;
  client: string;
  eventDate: string;
  quotePaise: number;
  createdAt: string;
  archivedAt: string | null;
  budgets: { category: Category; plannedPaise: number }[];
  expenses: { id: string; commitmentId: string | null; category: Category; description: string; amountPaise: number; spentOn: string }[];
  commitments: { id: string; vendor: string; category: Category; agreedPaise: number; dueOn: string }[];
  payments: { id: string; amountPaise: number; receivedOn: string; note: string }[];
};

export function vendorPaidPaise(event: EventRecord, commitmentId: string): number {
  return event.expenses.reduce((sum, expense) => sum + (expense.commitmentId === commitmentId ? expense.amountPaise : 0), 0);
}

export function categoryForecast(event: EventRecord, category: Category) {
  const budget = event.budgets.find((row) => row.category === category)?.plannedPaise ?? 0;
  const spent = event.expenses.reduce((sum, expense) => sum + (expense.category === category ? expense.amountPaise : 0), 0);
  const unpaidCommitments = event.commitments.reduce((sum, commitment) => {
    if (commitment.category !== category) return sum;
    return sum + Math.max(0, commitment.agreedPaise - vendorPaidPaise(event, commitment.id));
  }, 0);
  return { budget, spent, unpaidCommitments, forecast: Math.max(budget, spent + unpaidCommitments) };
}

export function metrics(event: EventRecord) {
  const planned = event.budgets.reduce((sum, row) => sum + row.plannedPaise, 0);
  const spent = event.expenses.reduce((sum, row) => sum + row.amountPaise, 0);
  const categories = categoriesFor(event.kind).map((category) => categoryForecast(event, category));
  const projectedCost = categories.reduce((sum, row) => sum + row.forecast, 0);
  const unpaidCommitments = categories.reduce((sum, row) => sum + row.unpaidCommitments, 0);
  const projectedProfit = event.quotePaise - projectedCost;
  const received = event.payments.reduce((sum, payment) => sum + payment.amountPaise, 0);
  return { planned, spent, unpaidCommitments, projectedCost, projectedProfit, received, balance: event.quotePaise - received, margin: event.quotePaise ? Math.round((projectedProfit / event.quotePaise) * 100) : 0 };
}

export function bakeryCloseout(order: EventRecord) {
  if (order.kind !== "bakery" || order.orderStatus !== "delivered") return null;
  const result = metrics(order);
  const recordedAndCommittedCost = result.spent + result.unpaidCommitments;
  const recordedCostProfit = order.quotePaise - recordedAndCommittedCost;
  return {
    estimatedCost: result.planned,
    recordedCost: result.spent,
    unpaidSupplierCost: result.unpaidCommitments,
    recordedAndCommittedCost,
    costDifference: result.planned - recordedAndCommittedCost,
    recordedCostProfit,
    recordedCostMargin: order.quotePaise ? Math.round((recordedCostProfit / order.quotePaise) * 100) : 0,
    customerBalance: result.balance,
    hasOutstanding: result.unpaidCommitments > 0 || result.balance > 0,
  };
}

export function belowMarginTarget(quotePaise: number, costPaise: number, targetMarginPct: number): boolean {
  return quotePaise > 0 && (quotePaise - costPaise) * 100 < quotePaise * targetMarginPct;
}
