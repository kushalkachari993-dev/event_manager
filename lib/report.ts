import { CATEGORIES, metrics, type EventRecord } from "./finance";

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
  const slug = event.name.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "event";
  return `eventprofit-${slug}-${event.eventDate}.csv`;
}

export function buildEventCsv(event: EventRecord): string {
  const result = metrics(event);
  const lines = [
    row("Event Profit Watch - Financial report"),
    row("Event", event.name),
    row("Client", event.client || "Not specified"),
    row("Event date", event.eventDate),
    row("Client quote (INR)", amount(event.quotePaise)),
    row("Planned costs (INR)", amount(result.planned)),
    row("Actual costs (INR)", amount(result.spent)),
    row("Projected cost (INR)", amount(result.projectedCost)),
    row("Projected profit (INR)", amount(result.projectedProfit)),
    row("Projected margin (%)", result.margin),
    row("Payments received (INR)", amount(result.received)),
    row(result.balance < 0 ? "Overpaid (INR)" : "Balance due (INR)", amount(Math.abs(result.balance))),
    "",
    row("Category", "Budget (INR)", "Spent (INR)", "Forecast cost (INR)"),
  ];

  for (const category of CATEGORIES) {
    const budget = event.budgets.find((item) => item.category === category)?.plannedPaise ?? 0;
    const spent = event.expenses.filter((item) => item.category === category).reduce((sum, item) => sum + item.amountPaise, 0);
    lines.push(row(category, amount(budget), amount(spent), amount(Math.max(budget, spent))));
  }

  lines.push("", row("Expenses"), row("Date", "Category", "Description", "Amount (INR)"));
  for (const expense of event.expenses) {
    lines.push(row(expense.spentOn, expense.category, expense.description, amount(expense.amountPaise)));
  }
  if (!event.expenses.length) lines.push(row("No expenses recorded"));

  lines.push("", row("Client payments"), row("Date", "Note", "Amount (INR)"));
  for (const payment of event.payments) {
    lines.push(row(payment.receivedOn, payment.note || "Client payment", amount(payment.amountPaise)));
  }
  if (!event.payments.length) lines.push(row("No payments recorded"));

  lines.push("", row("Forecast cost uses the higher of budget or actual spend in each category."));
  lines.push(row("This is an internal planning report, not an invoice or payment request."));
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
