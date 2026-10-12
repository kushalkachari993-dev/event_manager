"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { CATEGORIES, formatCurrency, metrics, vendorPaidPaise, type Category, type EventRecord } from "../lib/finance";

type Commitment = EventRecord["commitments"][number];

const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};
const prettyDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default function VendorCommitments({ event, onRefresh, onRecordPayment }: {
  event: EventRecord;
  onRefresh: () => Promise<void>;
  onRecordPayment: (commitmentId: string) => void;
}) {
  const [editing, setEditing] = useState<Commitment | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const unpaid = metrics(event).unpaidCommitments;

  async function save(data: { vendor: string; category: Category; agreed: number; dueOn: string }) {
    setSaving(true); setError("");
    try {
      const response = await fetch(editing ? `/api/commitments/${encodeURIComponent(editing.id)}` : "/api/commitments", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, eventId: event.id }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not save vendor commitment");
      await onRefresh();
      setOpen(false); setEditing(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save vendor commitment");
    } finally { setSaving(false); }
  }

  async function remove(commitment: Commitment) {
    if (!window.confirm(`Remove ${commitment.vendor}'s commitment? Recorded payments will stay in Expenses.`)) return;
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/commitments/${encodeURIComponent(commitment.id)}`, { method: "DELETE" });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not remove vendor commitment");
      await onRefresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not remove vendor commitment");
    } finally { setSaving(false); }
  }

  return <section className="expenses-card commitments-card">
    <div className="expenses-heading">
      <div><span className="section-kicker">UPCOMING COSTS</span><h2>Vendor commitments</h2></div>
      <button type="button" className="outline-button" onClick={() => { setEditing(null); setError(""); setOpen(true); }}><Plus size={16}/> Add commitment</button>
    </div>
    <p className="commitment-summary">{unpaid ? <><strong>{formatCurrency(unpaid)}</strong> still owed to vendors and included in your profit forecast.</> : "Record agreed vendor costs before you pay them so your forecast stays realistic."}</p>
    {error && !open && <div role="alert" className="error-banner">{error}<button onClick={() => setError("")} aria-label="Dismiss error"><X size={16}/></button></div>}
    {event.commitments.length ? <div className="commitment-list">{event.commitments.map((commitment) => {
      const paid = vendorPaidPaise(event, commitment.id);
      const remaining = Math.max(0, commitment.agreedPaise - paid);
      const status = remaining === 0 ? "Paid" : commitment.dueOn < today() ? "Overdue" : commitment.dueOn === today() ? "Due today" : `Due ${prettyDate(commitment.dueOn)}`;
      return <div className="commitment-row" key={commitment.id}>
        <div className="commitment-main"><strong>{commitment.vendor}</strong><span>{commitment.category} · {status}</span></div>
        <div className="commitment-amount"><strong>{formatCurrency(commitment.agreedPaise)} agreed</strong><span>{formatCurrency(paid)} paid · {formatCurrency(remaining)} remaining</span></div>
        <div className="commitment-actions">
          <button type="button" className="text-button" onClick={() => onRecordPayment(commitment.id)}>Record payment <ArrowRight size={15}/></button>
          <button type="button" className="icon-button" aria-label={`Edit commitment for ${commitment.vendor}`} onClick={() => { setEditing(commitment); setError(""); setOpen(true); }}><Pencil size={15}/></button>
          <button type="button" className="icon-button danger-icon" aria-label={`Remove commitment for ${commitment.vendor}`} disabled={saving} onClick={() => void remove(commitment)}><Trash2 size={15}/></button>
        </div>
      </div>;
    })}</div> : <div className="no-expenses">No vendor commitments yet. Add an agreed cost to see its impact before payment.</div>}
    {open && <CommitmentModal key={editing?.id ?? "new"} eventName={event.name} commitment={editing} error={error} saving={saving} close={() => { setOpen(false); setEditing(null); setError(""); }} save={save}/>}
  </section>;
}

function CommitmentModal({ eventName, commitment, error, saving, close, save }: {
  eventName: string;
  commitment: Commitment | null;
  error: string;
  saving: boolean;
  close: () => void;
  save: (data: { vendor: string; category: Category; agreed: number; dueOn: string }) => void;
}) {
  const [vendor, setVendor] = useState(commitment?.vendor ?? "");
  const [category, setCategory] = useState<Category>(commitment?.category ?? "Flowers");
  const [agreed, setAgreed] = useState(commitment ? String(commitment.agreedPaise / 100) : "");
  const [dueOn, setDueOn] = useState(commitment?.dueOn ?? today());
  function onSubmit(event: FormEvent) { event.preventDefault(); save({ vendor, category, agreed: Number(agreed), dueOn }); }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <form className="modal compact" onSubmit={onSubmit}>
      <div className="modal-header"><div><span className="section-kicker">VENDOR COSTS</span><h2>{commitment ? "Edit commitment" : "Add commitment"}</h2><p>{eventName}</p></div><button type="button" className="icon-button" onClick={close} aria-label="Close"><X size={20}/></button></div>
      {error && <div role="alert" className="modal-error">{error}</div>}
      <div className="modal-body">
        <p className="payment-help">An agreed cost affects the forecast now. Record payments against it as they happen.</p>
        <div className="field"><label htmlFor="vendor-name">Vendor name</label><input id="vendor-name" required maxLength={100} placeholder="e.g. Sharma Flowers" value={vendor} onChange={(event) => setVendor(event.target.value)}/></div>
        <div className="two-fields">
          <div className="field"><label htmlFor="commitment-category">Category</label><select id="commitment-category" value={category} onChange={(event) => setCategory(event.target.value as Category)}>{CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></div>
          <div className="field"><label htmlFor="commitment-agreed">Agreed cost (₹)</label><input id="commitment-agreed" type="number" min="0.01" step="0.01" required placeholder="12000" value={agreed} onChange={(event) => setAgreed(event.target.value)}/></div>
        </div>
        <div className="field"><label htmlFor="commitment-due">Payment due date</label><input id="commitment-due" type="date" required value={dueOn} onChange={(event) => setDueOn(event.target.value)}/></div>
      </div>
      <div className="modal-actions"><button type="button" className="cancel-button" onClick={close}>Cancel</button><button type="submit" className="primary-button" disabled={saving}>{saving ? "Saving…" : commitment ? "Save changes" : "Add commitment"} <Check size={17}/></button></div>
    </form>
  </div>;
}
