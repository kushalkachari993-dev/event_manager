import type { EventRecord } from "./finance";

export type OrderAttention = "overdue" | "due_today" | "due_soon" | "payment_due" | null;

export function orderAttention(order: EventRecord, today: string): OrderAttention {
  if (order.kind !== "bakery" || order.archivedAt) return null;
  if (order.orderStatus === "delivered") {
    const received = order.payments.reduce((sum, payment) => sum + payment.amountPaise, 0);
    return order.quotePaise > received ? "payment_due" : null;
  }
  const days = Math.round((Date.parse(`${order.eventDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  if (days < 0) return "overdue";
  if (days === 0) return "due_today";
  return days <= 3 ? "due_soon" : null;
}

export const ATTENTION_LABELS: Record<Exclude<OrderAttention, null>, string> = {
  overdue: "Delivery overdue", due_today: "Due today", due_soon: "Due soon", payment_due: "Payment due",
};
