import { bakeryCloseout, categoriesFor, categoryForecast, metrics, ORDER_STAGE_LABELS, vendorPaidPaise, type EventRecord } from "./finance";

const amount = (paise: number) => paise / 100;

function csvText(value: string): string {
  const singleLine = value.replace(/[\r\n]+/g, " ");
  const safe = /^[\s]*[=+\-@]/.test(singleLine) ? `'${singleLine}` : singleLine;
  return `"${safe.replace(/"/g, '""')}"`;
}

function row(...cells: (string | number)[]): string {
  return cells.map((cell) => typeof cell === "number" ? String(cell) : csvText(cell)).join(",");
}

export function eventReportFilename(event: EventRecord): string {
  const slug = event.name.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || (event.kind === "bakery" ? "order" : "event");
  return event.kind === "bakery" ? `eventprofit-order-${slug}-${event.eventDate}.csv` : `eventprofit-${slug}-${event.eventDate}.csv`;
}

export function buildEventCsv(event: EventRecord): string {
  const result = metrics(event);
  const isBakery = event.kind === "bakery";
  const closeout = bakeryCloseout(event);
  const lines = [
    row(isBakery ? "Event Profit Watch - Bakery order report" : "Event Profit Watch - Financial report"),
    row(isBakery ? "Order" : "Event", event.name),
    row(isBakery ? "Customer" : "Client", event.client || "Not specified"),
    row(isBakery ? "Delivery date" : "Event date", event.eventDate),
    ...(isBakery ? [row("Order stage", ORDER_STAGE_LABELS[event.orderStatus])] : []),
    row(isBakery ? "Order price (INR)" : "Client quote (INR)", amount(event.quotePaise)),
    row("Planned costs (INR)", amount(result.planned)),
    row("Actual costs (INR)", amount(result.spent)),
    row(isBakery ? "Unpaid supplier commitments (INR)" : "Unpaid vendor commitments (INR)", amount(result.unpaidCommitments)),
    row("Projected cost (INR)", amount(result.projectedCost)),
    row("Projected profit (INR)", amount(result.projectedProfit)),
    row("Projected margin (%)", result.margin),
    row("Payments received (INR)", amount(result.received)),
    row(result.balance < 0 ? "Overpaid (INR)" : "Balance due (INR)", amount(Math.abs(result.balance))),
    "",
    ...(closeout ? [
      row("Delivered order close-out", closeout.hasOutstanding ? "Provisional" : "Recorded snapshot"),
      row("Original cost estimate (INR)", amount(closeout.estimatedCost)),
      row("Expenses recorded (INR)", amount(closeout.recordedCost)),
      row("Unpaid supplier commitments (INR)", amount(closeout.unpaidSupplierCost)),
      row("Recorded + committed cost (INR)", amount(closeout.recordedAndCommittedCost)),
      row("Difference from estimate (INR; positive is below estimate)", amount(closeout.costDifference)),
      row("Profit based on recorded costs (INR)", amount(closeout.recordedCostProfit)),
      row("Recorded-cost margin (%)", closeout.recordedCostMargin),
      row(closeout.customerBalance < 0 ? "Customer overpaid (INR)" : "Customer balance due (INR)", amount(Math.abs(closeout.customerBalance))),
      row("Close-out note", "Based on entered costs and unpaid supplier commitments. Add missing costs before relying on this profit figure."),
      "",
    ] : []),
    row("Category", "Budget (INR)", "Spent (INR)", "Forecast cost (INR)"),
  ];

  for (const category of categoriesFor(event.kind)) {
    const { budget, spent, forecast } = categoryForecast(event, category);
    lines.push(row(category, amount(budget), amount(spent), amount(forecast)));
  }

  lines.push("", row("Expenses"), row("Date", "Category", "Description", "Amount (INR)"));
  for (const expense of event.expenses) {
    lines.push(row(expense.spentOn, expense.category, expense.description, amount(expense.amountPaise)));
  }
  if (!event.expenses.length) lines.push(row("No expenses recorded"));

  lines.push("", row(isBakery ? "Supplier commitments" : "Vendor commitments"), row(isBakery ? "Supplier" : "Vendor", "Category", "Agreed (INR)", "Paid (INR)", "Remaining (INR)", "Due date"));
  for (const commitment of event.commitments) {
    const paid = vendorPaidPaise(event, commitment.id);
    lines.push(row(commitment.vendor, commitment.category, amount(commitment.agreedPaise), amount(paid), amount(Math.max(0, commitment.agreedPaise - paid)), commitment.dueOn));
  }
  if (!event.commitments.length) lines.push(row(`No ${isBakery ? "supplier" : "vendor"} commitments recorded`));

  lines.push("", row(isBakery ? "Customer payments" : "Client payments"), row("Date", "Note", "Amount (INR)"));
  for (const payment of event.payments) {
    lines.push(row(payment.receivedOn, payment.note || (isBakery ? "Customer payment" : "Client payment"), amount(payment.amountPaise)));
  }
  if (!event.payments.length) lines.push(row("No payments recorded"));

  lines.push("", row(`Forecast cost uses the higher of budget or paid costs plus unpaid ${isBakery ? "supplier" : "vendor"} commitments in each category.`));
  lines.push(row("This is an internal planning report, not an invoice or payment request."));
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
