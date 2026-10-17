import { bakeryCloseout, formatCurrency as money, type EventRecord } from "../lib/finance";

export default function OrderCloseout({ order }: { order: EventRecord }) {
  const closeout = bakeryCloseout(order);
  if (!closeout) return null;

  return <section className="closeout-card" aria-label="Order close-out">
    <div className="closeout-heading">
      <div><span className="section-kicker">DELIVERED ORDER</span><h2>Order close-out</h2><p>Compare your first cost estimate with what you have recorded so far.</p></div>
      <span className="closeout-status">{closeout.hasOutstanding ? "Provisional" : "Recorded snapshot"}</span>
    </div>
    <div className="closeout-grid">
      <div><span>Original cost estimate</span><strong>{money(closeout.estimatedCost)}</strong></div>
      <div><span>Expenses recorded</span><strong>{money(closeout.recordedCost)}</strong></div>
      <div><span>Supplier commitments still owed</span><strong>{money(closeout.unpaidSupplierCost)}</strong></div>
      <div><span>Recorded + committed cost</span><strong>{money(closeout.recordedAndCommittedCost)}</strong></div>
    </div>
    <div className="closeout-result">
      <div><span>Difference from estimate</span><strong className={closeout.costDifference < 0 ? "closeout-over" : ""}>{closeout.costDifference < 0 ? `${money(-closeout.costDifference)} above estimate` : `${money(closeout.costDifference)} below estimate`}</strong></div>
      <div><span>Profit based on recorded costs</span><strong className={closeout.recordedCostProfit < 0 ? "closeout-over" : ""}>{money(closeout.recordedCostProfit)} <small>({closeout.recordedCostMargin}% margin)</small></strong></div>
      <div><span>{closeout.customerBalance < 0 ? "Customer overpaid" : "Customer balance due"}</span><strong>{money(Math.abs(closeout.customerBalance))}</strong></div>
    </div>
    <p className="closeout-note">{closeout.recordedCost === 0 && closeout.estimatedCost > 0 ? "No expenses have been recorded yet. " : ""}This is based on entered expenses and unpaid supplier commitments. Add any missing costs before relying on this profit figure. Customer payments affect the balance due, not the order price used for profit.</p>
  </section>;
}
