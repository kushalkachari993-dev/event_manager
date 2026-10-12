import { CATEGORIES, categoryForecast, metrics, vendorPaidPaise, type EventRecord } from "../lib/finance";

const money = (paise: number) => new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(paise / 100);
const date = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString("en-IN", {
  day: "numeric", month: "short", year: "numeric",
});

export default function EventReport({ event }: { event: EventRecord }) {
  const result = metrics(event);

  return <article className="print-report">
    <header className="report-header">
      <div><div className="report-brand">eventprofit<span>.</span></div><p>Event financial report</p></div>
      <div className="report-date">Event date<br/><strong>{date(event.eventDate)}</strong></div>
    </header>

    <div className="report-intro">
      <p className="report-eyebrow">EVENT OVERVIEW</p>
      <h1>{event.name}</h1>
      <p>Client: {event.client || "Not specified"}</p>
    </div>

    <section className="report-summary" aria-label="Financial summary">
      <div><span>Client quote</span><strong>{money(event.quotePaise)}</strong></div>
      <div><span>Projected profit</span><strong>{money(result.projectedProfit)}</strong><small>{result.margin}% projected margin</small></div>
      <div><span>Payments received</span><strong>{money(result.received)}</strong></div>
      <div><span>{result.balance < 0 ? "Overpaid" : "Balance due"}</span><strong>{money(Math.abs(result.balance))}</strong></div>
    </section>

    <section className="report-section">
      <h2>Cost breakdown</h2>
      <table>
        <thead><tr><th scope="col">Category</th><th scope="col">Budget</th><th scope="col">Spent</th><th scope="col">Forecast</th></tr></thead>
        <tbody>{CATEGORIES.map((category) => {
          const { budget, spent, forecast } = categoryForecast(event, category);
          return <tr key={category}><th scope="row">{category}</th><td>{money(budget)}</td><td>{money(spent)}</td><td>{money(forecast)}</td></tr>;
        })}</tbody>
        <tfoot><tr><th scope="row">Total costs</th><td>{money(result.planned)}</td><td>{money(result.spent)}</td><td>{money(result.projectedCost)}</td></tr></tfoot>
      </table>
    </section>

    <section className="report-section">
      <h2>Vendor commitments</h2>
      {event.commitments.length ? <table>
        <thead><tr><th scope="col">Vendor / due</th><th scope="col">Category</th><th scope="col">Agreed</th><th scope="col">Paid</th><th scope="col">Remaining</th></tr></thead>
        <tbody>{event.commitments.map((commitment) => {
          const paid = vendorPaidPaise(event, commitment.id);
          return <tr key={commitment.id}><td>{commitment.vendor}<br/>{date(commitment.dueOn)}</td><td>{commitment.category}</td><td>{money(commitment.agreedPaise)}</td><td>{money(paid)}</td><td>{money(Math.max(0, commitment.agreedPaise - paid))}</td></tr>;
        })}</tbody>
      </table> : <p className="report-empty">No vendor commitments recorded.</p>}
    </section>

    <section className="report-section">
      <h2>Expenses</h2>
      {event.expenses.length ? <table>
        <thead><tr><th scope="col">Date</th><th scope="col">Description</th><th scope="col">Category</th><th scope="col">Amount</th></tr></thead>
        <tbody>{event.expenses.map((expense) => <tr key={expense.id}><td>{date(expense.spentOn)}</td><td>{expense.description}</td><td>{expense.category}</td><td>{money(expense.amountPaise)}</td></tr>)}</tbody>
      </table> : <p className="report-empty">No expenses recorded.</p>}
    </section>

    <section className="report-section">
      <h2>Client payments</h2>
      {event.payments.length ? <table>
        <thead><tr><th scope="col">Date</th><th scope="col">Note</th><th scope="col">Amount</th></tr></thead>
        <tbody>{event.payments.map((payment) => <tr key={payment.id}><td>{date(payment.receivedOn)}</td><td>{payment.note || "Client payment"}</td><td>{money(payment.amountPaise)}</td></tr>)}</tbody>
      </table> : <p className="report-empty">No payments recorded.</p>}
    </section>

    <footer className="report-footer">
      <p>Forecast cost uses the higher of budget or paid costs plus unpaid vendor commitments in each category.</p>
      <p>Internal planning report. This is not an invoice or payment request.</p>
    </footer>
  </article>;
}
