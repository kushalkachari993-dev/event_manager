"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Archive, ArrowDownRight, ArrowRight, CakeSlice, CalendarDays, Check, ChevronDown, CircleHelp, Download, IndianRupee, Layers3, Pencil, Plus, Printer, RotateCcw, Settings2, Sparkles, Trash2, TrendingUp, Wallet, X } from "lucide-react";
import { belowMarginTarget, categoriesFor, categoryForecast, formatCurrency as currency, metrics, ORDER_STAGES, ORDER_STAGE_LABELS, type BusinessKind, type Category, type EventRecord, type Fulfillment, type OrderStatus } from "../lib/finance";
import { ATTENTION_LABELS, orderAttention } from "../lib/order-workflow";
import { buildEventCsv, eventReportFilename } from "../lib/report";
import EventReport from "./event-report";
import VendorCommitments from "./vendor-commitments";
import CustomerQuoteModal from "./customer-quote";
import BakeryProfileModal from "./bakery-profile";
import { emptyBakeryProfile, type BakeryProfile } from "../lib/business-profile";

const today = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const prettyDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

type Mode = "event" | "expense" | "edit-event" | "edit-expense" | "payment" | "edit-payment" | "customer-quote" | "bakery-profile" | null;
type View = "overview" | "events" | "bakery";

export default function Dashboard({ displayName }: { displayName: string }) {
  const [items, setItems] = useState<EventRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [recordingCommitmentId, setRecordingCommitmentId] = useState<string | null>(null);
  const [view, setView] = useState<View>("overview");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [bakeryProfile, setBakeryProfile] = useState<BakeryProfile>(emptyBakeryProfile);
  const [profileError, setProfileError] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/bakery-profile", { cache: "no-store" }).then(async (response) => {
      const data = await response.json() as { profile?: BakeryProfile; error?: string };
      if (!response.ok || !data.profile) throw new Error(data.error || "Could not load bakery profile");
      if (active) setBakeryProfile(data.profile);
    }).catch(() => { if (active) setProfileError("Could not load your bakery profile. Please refresh before sharing a quote."); });
    return () => { active = false; };
  }, []);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/events", { cache: "no-store" });
      const data = await response.json() as { events: EventRecord[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not load events");
      setItems(data.events);
      setSelectedId((current) => current && data.events.some((event: EventRecord) => event.id === current && !event.archivedAt) ? current : data.events.find((event: EventRecord) => !event.archivedAt)?.id ?? null);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load events");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  const workspaceKind: BusinessKind = view === "bakery" ? "bakery" : "event";
  const isBakery = workspaceKind === "bakery";
  const activeItems = items.filter((item) => item.kind === workspaceKind && !item.archivedAt);
  const archivedItems = items.filter((item) => item.kind === workspaceKind && item.archivedAt);
  const selected = activeItems.find((item) => item.id === selectedId) ?? activeItems[0] ?? null;
  const editingExpense = selected?.expenses.find((expense) => expense.id === editingExpenseId);
  const editingPayment = selected?.payments.find((payment) => payment.id === editingPaymentId);
  const selectedMetrics = selected ? metrics(selected) : null;
  const selectedBelowTarget = !!(isBakery && selected && selectedMetrics && belowMarginTarget(selected.quotePaise, selectedMetrics.projectedCost, selected.targetMarginPct));
  const all = useMemo(() => items.filter((item) => item.kind === workspaceKind && !item.archivedAt).map(metrics), [items, workspaceKind]);
  const totals = {
    forecast: all.reduce((n, item) => n + item.projectedProfit, 0),
    spent: all.reduce((n, item) => n + item.spent, 0),
    balanceDue: all.reduce((n, item) => n + Math.max(0, item.balance), 0),
  };
  const firstName = displayName.split(/[ @]/)[0] || "there";

  function switchView(nextView: View) {
    setView(nextView);
    const kind = nextView === "bakery" ? "bakery" : "event";
    setSelectedId((current) => items.some((item) => item.id === current && item.kind === kind && !item.archivedAt)
      ? current : items.find((item) => item.kind === kind && !item.archivedAt)?.id ?? null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(path: string, payload: unknown, method = "POST") {
    setSaving(true); setError("");
    try {
      const response = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: method === "DELETE" ? undefined : JSON.stringify(payload) });
      const data = await response.json() as { id?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not save");
      await load();
      if (data.id) { setSelectedId(data.id); setView(isBakery ? "bakery" : "events"); }
      setMode(null);
      setEditingExpenseId(null);
      setEditingPaymentId(null);
      setRecordingCommitmentId(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save");
    } finally { setSaving(false); }
  }

  async function removeExpense(id: string, description: string) {
    if (window.confirm(`Remove “${description}”? This expense cannot be recovered.`)) {
      await submit(`/api/expenses/${encodeURIComponent(id)}`, null, "DELETE");
    }
  }

  async function removePayment(id: string) {
    if (window.confirm("Remove this payment record? The balance due will update.")) {
      await submit(`/api/payments/${encodeURIComponent(id)}`, null, "DELETE");
    }
  }

  function downloadCsv(event: EventRecord) {
    const blob = new Blob([buildEventCsv(event)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = eventReportFilename(event);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  return <><div className="shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark"><Layers3 size={20} strokeWidth={2.4}/></span><span>event<span className="brand-light">profit</span><b>.</b></span></div>
      <div className="workspace-label">WORKSPACE</div>
      <nav className="side-nav" aria-label="Workspace">
        <button type="button" className={`nav-item ${view === "overview" ? "active" : ""}`} aria-current={view === "overview" ? "page" : undefined} onClick={() => switchView("overview")}><span className="nav-dot"/> Overview</button>
        <button type="button" className={`nav-item ${view === "events" ? "active" : ""}`} aria-current={view === "events" ? "page" : undefined} onClick={() => switchView("events")}><CalendarDays size={18}/> Events</button>
        <button type="button" className={`nav-item ${view === "bakery" ? "active" : ""}`} aria-current={view === "bakery" ? "page" : undefined} onClick={() => switchView("bakery")}><CakeSlice size={18}/> Bakery orders</button>
      </nav>
      <div className="side-spacer"/>
      <div className="side-note"><div className="side-note-icon"><Sparkles size={17}/></div><strong>Know your number</strong><p>Track every cost while there is still time to protect your profit.</p></div>
      <div className="profile"><div className="avatar">{firstName.slice(0, 1).toUpperCase()}</div><div><strong>{firstName}</strong><span>Private workspace</span></div><ChevronDown size={15}/></div>
    </aside>

    <main className="main">
      <header className="topbar"><div className="crumb">Workspace <span>/</span> <strong>{view === "overview" ? "Overview" : isBakery ? "Bakery orders" : "Events"}</strong></div><div className="topbar-right"><span className="secure-pill"><span/> Private dashboard</span><div className="small-avatar">{firstName.slice(0, 1).toUpperCase()}</div></div></header>
      <nav className="mobile-nav" aria-label="Workspace"><button type="button" className={view === "overview" ? "active" : ""} onClick={() => switchView("overview")}>Overview</button><button type="button" className={view === "events" ? "active" : ""} onClick={() => switchView("events")}>Events</button><button type="button" className={view === "bakery" ? "active" : ""} onClick={() => switchView("bakery")}>Bakery</button></nav>
      <div className={`content ${view !== "overview" ? "events-view" : ""}`}>
        <section className="heading"><div><div className="eyebrow">{isBakery ? "YOUR CUSTOM-ORDER WORKSPACE" : view === "overview" ? "YOUR FINANCIAL CONTROL ROOM" : "YOUR EVENT WORKSPACE"}</div><h1>{isBakery ? "Your bakery orders" : view === "overview" ? <>Good morning, {firstName} <span className="wave">✳</span></> : "Your events"}</h1><p>{isBakery ? "Price each order, track ingredient costs, and protect your margin." : view === "overview" ? "Keep your event costs in view and your margins on track." : "Review budgets, expenses, and projected profit for every event."}</p></div><div className="heading-actions">{isBakery && <button type="button" className="outline-button" onClick={() => setMode("bakery-profile")}><Settings2 size={16}/> Business profile</button>}<button className="primary-button" onClick={() => { setError(""); setMode("event"); }}><Plus size={18}/> {isBakery ? "New order" : "New event"}</button></div></section>
        {isBakery && profileError && <div role="alert" className="error-banner">{profileError}<button onClick={() => setProfileError("")} aria-label="Dismiss error"><X size={16}/></button></div>}
        {error && <div role="alert" className="error-banner">{error}<button onClick={() => setError("")} aria-label="Dismiss error"><X size={16}/></button></div>}
        {loading ? <div className="loading">Loading your workspace…</div> : <>
          {view !== "events" && <section className="metric-grid">
            <Metric icon={isBakery ? <CakeSlice size={20}/> : <CalendarDays size={20}/>} label={isBakery ? "Active orders" : "Active events"} value={String(activeItems.length)} note={isBakery ? "Orders in your workspace" : "Events in your workspace"} tone="purple" />
            <Metric icon={<TrendingUp size={20}/>} label="Projected profit" value={currency(totals.forecast)} note={isBakery ? "Includes supplier commitments" : "Includes vendor commitments"} tone="green" />
            <Metric icon={<Wallet size={20}/>} label="Expenses logged" value={currency(totals.spent)} note="Actual spend to date" tone="blue" />
            <Metric icon={<IndianRupee size={20}/>} label={isBakery ? "Customer balance due" : "Client balance due"} value={currency(totals.balanceDue)} note={isBakery ? "Unpaid across active orders" : "Unpaid across active events"} tone="orange" />
          </section>}

          {activeItems.length === 0 ? <div className="empty-layout"><div className="empty-card"><div className="empty-icon">{isBakery ? <CakeSlice size={30}/> : <Layers3 size={30}/>}</div><span className="section-kicker">START HERE</span><h2>{isBakery ? "Know the profit on every custom order." : "Make your next event more profitable."}</h2><p>{isBakery ? "Add an order with its selling price and estimated ingredients, labour, packaging, and delivery costs. Record what you actually spend and receive as the order moves forward." : "Add an event with your quote and category budgets. Then record expenses as they happen to see your projected profit update."}</p><button className="primary-button" onClick={() => setMode("event")}><Plus size={18}/> {isBakery ? "Create first order" : "Create first event"}</button></div><div className="how-card"><span className="section-kicker">HOW IT WORKS</span><div className="how-row"><span>01</span><div><strong>Plan</strong><p>{isBakery ? "Set a selling price and estimate each cost." : "Set a quote and budget by category."}</p></div></div><div className="how-row"><span>02</span><div><strong>Track</strong><p>Log each actual expense and customer payment.</p></div></div><div className="how-row"><span>03</span><div><strong>Protect</strong><p>Spot overruns before they eat your margin.</p></div></div></div></div> : <>
            <div className="section-heading"><div><span className="section-kicker">YOUR PORTFOLIO</span><h2>{isBakery ? "Orders" : "Events"} <span className="count">{activeItems.length}</span></h2></div><span className="subtle">Select {isBakery ? "an order" : "an event"} to inspect its costs</span></div>
            <div className="event-tabs">{activeItems.map((item) => { const m = metrics(item); return <button key={item.id} className={`event-tab ${selected?.id === item.id ? "selected" : ""}`} onClick={() => setSelectedId(item.id)}><span className="event-tab-icon">{isBakery ? <CakeSlice size={18}/> : <CalendarDays size={18}/>}</span><span><strong>{item.name}</strong><small>{prettyDate(item.eventDate)} · {currency(item.quotePaise)} {isBakery ? "price" : "quote"}{isBakery ? ` · ${ORDER_STAGE_LABELS[item.orderStatus]}` : ""}</small></span><span className={`tab-profit ${m.projectedProfit < 0 ? "negative" : ""}`}>{currency(m.projectedProfit)} <ArrowRight size={16}/></span></button>; })}</div>
            {isBakery && selected && <BakeryOrderWorkflow orders={activeItems} selected={selected} saving={saving} select={setSelectedId} update={(status) => void submit(`/api/events/${encodeURIComponent(selected.id)}`, { action: "set-order-status", status }, "PATCH")}/>}
            {selectedBelowTarget && selected && selectedMetrics && <div className="forecast-margin-alert" role="alert"><strong>Below your margin target</strong><span>Current projected margin is {selectedMetrics.margin}%; your private target is {selected.targetMarginPct}%. Review the price or costs before confirming this order.</span></div>}
            {selected && selectedMetrics && <div className="detail-grid"><section className="detail-card"><div className="detail-top"><div><span className="section-kicker">PROFIT FORECAST</span><h2>{selected.name}</h2><p>{selected.client || (isBakery ? "Customer not specified" : "Client not specified")} <span>·</span> {prettyDate(selected.eventDate)}</p></div><div className={`status ${(selectedMetrics.projectedProfit < 0 || selectedBelowTarget) ? "at-risk" : ""}`}><span/> {selectedMetrics.projectedProfit < 0 ? "At risk" : selectedBelowTarget ? "Below target" : "On track"}</div></div><div className="record-actions"><button type="button" className="text-button" onClick={() => { setError(""); setMode("edit-event"); }}><Pencil size={14}/> {isBakery ? "Edit order & costs" : "Edit event & budgets"}</button><button type="button" className="text-button muted-action" disabled={saving} onClick={() => void submit(`/api/events/${encodeURIComponent(selected.id)}`, { action: "archive" }, "PATCH")}><Archive size={14}/> {isBakery ? "Archive order" : "Archive event"}</button></div><div className="profit-feature"><div><span>Projected profit</span><strong className={selectedMetrics.projectedProfit < 0 ? "negative-text" : ""}>{currency(selectedMetrics.projectedProfit)}</strong><small>{selectedMetrics.margin}% projected margin</small></div><div className="profit-graphic"><TrendingUp size={46} strokeWidth={1.4}/></div></div><div className="finance-row"><div><span>{isBakery ? "Order price" : "Client quote"}</span><strong>{currency(selected.quotePaise)}</strong></div><div><span>Planned costs</span><strong>{currency(selectedMetrics.planned)}</strong></div><div><span>Spent so far</span><strong>{currency(selectedMetrics.spent)}</strong></div><div><span>Projected cost</span><strong>{currency(selectedMetrics.projectedCost)}</strong></div></div><div className="formula"><CircleHelp size={16}/><span>Forecast uses the higher of each category budget or paid costs plus unpaid {isBakery ? "supplier" : "vendor"} commitments.</span></div></section>
            <section className="detail-card cost-card"><div className="cost-heading"><div><span className="section-kicker">WHERE THE MONEY GOES</span><h2>Cost breakdown</h2></div><button className="outline-button" onClick={() => { setError(""); setRecordingCommitmentId(null); setMode("expense"); }}><Plus size={16}/> Add expense</button></div><div className="category-list">{categoriesFor(selected.kind).map((category) => { const { budget, spent, unpaidCommitments, forecast } = categoryForecast(selected, category); const progress = budget ? Math.min(100, (spent / budget) * 100) : spent ? 100 : 0; return <div className="category-row" key={category}><div className="category-line"><strong>{category}</strong><span className={forecast > budget ? "overrun" : ""}>{currency(spent)} <em>/ {currency(budget)}</em></span></div><div className="progress"><span className={forecast > budget ? "overrun-fill" : ""} style={{ width: `${progress}%` }}/></div>{unpaidCommitments > 0 && <div className="category-forecast">{currency(unpaidCommitments)} unpaid · {currency(forecast)} forecast</div>}</div>; })}</div></section></div>}
            {selected && (
              <VendorCommitments key={selected.id} event={selected} onRefresh={load} onRecordPayment={(commitmentId) => { setError(""); setRecordingCommitmentId(commitmentId); setMode("expense"); }}/>
            )}
            {selected && <section className="expenses-card"><div className="expenses-heading"><div><span className="section-kicker">ACTIVITY</span><h2>Expenses</h2></div><button className="text-button" onClick={() => { setRecordingCommitmentId(null); setMode("expense"); }}>Add expense <ArrowRight size={16}/></button></div>{selected.expenses.length ? <div className="expense-list">{selected.expenses.map((expense) => <div className="expense-row" key={expense.id}><div className="expense-icon"><ArrowDownRight size={18}/></div><div className="expense-description"><strong>{expense.description}</strong><span>{expense.category}{expense.commitmentId ? (isBakery ? " · Supplier payment" : " · Vendor payment") : ""} · {prettyDate(expense.spentOn)}</span></div><strong>{currency(expense.amountPaise)}</strong><div className="expense-actions"><button type="button" className="icon-button" aria-label={`Edit ${expense.description}`} title="Edit expense" onClick={() => { setError(""); setEditingExpenseId(expense.id); setMode("edit-expense"); }}><Pencil size={15}/></button><button type="button" className="icon-button danger-icon" aria-label={`Remove ${expense.description}`} title="Remove expense" disabled={saving} onClick={() => void removeExpense(expense.id, expense.description)}><Trash2 size={15}/></button></div></div>)}</div> : <div className="no-expenses">No expenses logged yet. Add one as soon as you make a purchase.</div>}</section>}
            {selected && selectedMetrics && <section className="payments-card">
              <div className="expenses-heading">
                <div><span className="section-kicker">{isBakery ? "CUSTOMER PAYMENTS" : "CLIENT PAYMENTS"}</span><h2>Payments received</h2></div>
                <button type="button" className="outline-button" onClick={() => { setError(""); setMode("payment"); }}><Plus size={16}/> Record payment</button>
              </div>
              <div className="payment-summary">
                <div><span>{isBakery ? "Order price" : "Client quote"}</span><strong>{currency(selected.quotePaise)}</strong></div>
                <div><span>Received</span><strong>{currency(selectedMetrics.received)}</strong></div>
                <div><span>{selectedMetrics.balance < 0 ? "Overpaid" : "Balance due"}</span><strong className={selectedMetrics.balance > 0 ? "balance-due" : "balance-settled"}>{currency(Math.abs(selectedMetrics.balance))}</strong></div>
              </div>
              {selected.payments.length ? <div className="payment-list">{selected.payments.map((payment) => <div className="expense-row" key={payment.id}>
                <div className="payment-icon"><IndianRupee size={18}/></div>
                <div className="expense-description"><strong>{payment.note || (isBakery ? "Customer payment" : "Client payment")}</strong><span>Received {prettyDate(payment.receivedOn)}</span></div>
                <strong>{currency(payment.amountPaise)}</strong>
                <div className="expense-actions">
                  <button type="button" className="icon-button" aria-label={`Edit payment from ${prettyDate(payment.receivedOn)}`} title="Edit payment" onClick={() => { setError(""); setEditingPaymentId(payment.id); setMode("edit-payment"); }}><Pencil size={15}/></button>
                  <button type="button" className="icon-button danger-icon" aria-label={`Remove payment from ${prettyDate(payment.receivedOn)}`} title="Remove payment" disabled={saving} onClick={() => void removePayment(payment.id)}><Trash2 size={15}/></button>
                </div>
              </div>)}</div> : <div className="no-expenses">{isBakery ? "No payments recorded yet. Add a deposit when your customer pays you." : "No payments recorded yet. Add a deposit when your client pays you."}</div>}
            </section>}
            {isBakery && selected && <section className="customer-share-card"><div><span className="section-kicker">READY TO SHARE</span><h2>Customer quote & confirmation</h2><p>Preview a customer-safe document with your bakery branding, order details, price, deposit, and balance. Your costs and profit stay private.</p></div><button type="button" className="primary-button" onClick={() => setMode("customer-quote")}>Preview customer quote <ArrowRight size={16}/></button></section>}
            {selected && <section className="report-card">
              <div><span className="section-kicker">{isBakery ? "ORDER REPORT" : "EVENT REPORT"}</span><h2>{isBakery ? "Share your order numbers" : "Share your event numbers"}</h2><p>Get a printable summary or download the underlying figures as a spreadsheet file.</p></div>
              <div className="report-actions">
                <button type="button" className="outline-button" onClick={() => downloadCsv(selected)}><Download size={16}/> Download CSV</button>
                <button type="button" className="primary-button" onClick={() => window.print()}><Printer size={16}/> Print / Save PDF</button>
              </div>
            </section>}
          </>}
          {(view === "events" || view === "bakery") && archivedItems.length > 0 && <section className="archive-section"><div className="section-heading"><div><span className="section-kicker">PAST WORK</span><h2>{isBakery ? "Archived orders" : "Archived events"} <span className="count">{archivedItems.length}</span></h2></div></div><div className="archive-list">{archivedItems.map((item) => <div className="archive-row" key={item.id}><div><strong>{item.name}</strong><span>{prettyDate(item.eventDate)} · {currency(item.quotePaise)} {isBakery ? "price" : "quote"}</span></div><button type="button" className="outline-button" disabled={saving} onClick={() => void submit(`/api/events/${encodeURIComponent(item.id)}`, { action: "restore" }, "PATCH")}><RotateCcw size={14}/> Restore</button></div>)}</div></section>}
        </>}
      </div>
    </main>
    {(mode === "event" || mode === "edit-event") && <EventModal kind={workspaceKind} eventRecord={mode === "edit-event" ? selected : null} error={error} close={() => setMode(null)} saving={saving} submit={(data) => submit(mode === "edit-event" && selected ? `/api/events/${encodeURIComponent(selected.id)}` : "/api/events", data, mode === "edit-event" ? "PATCH" : "POST")} />}
    {(mode === "expense" || mode === "edit-expense") && selected && <ExpenseModal kind={selected.kind} eventName={selected.name} eventId={selected.id} expense={mode === "edit-expense" ? editingExpense : undefined} commitment={selected.commitments.find((item) => item.id === (mode === "edit-expense" ? editingExpense?.commitmentId : recordingCommitmentId))} error={error} close={() => { setMode(null); setEditingExpenseId(null); setRecordingCommitmentId(null); }} saving={saving} submit={(data) => submit(mode === "edit-expense" && editingExpense ? `/api/expenses/${encodeURIComponent(editingExpense.id)}` : "/api/expenses", data, mode === "edit-expense" ? "PATCH" : "POST")} />}
    {(mode === "payment" || mode === "edit-payment") && selected && <PaymentModal kind={selected.kind} eventName={selected.name} eventId={selected.id} payment={mode === "edit-payment" ? editingPayment : undefined} error={error} close={() => { setMode(null); setEditingPaymentId(null); }} saving={saving} submit={(data) => submit(mode === "edit-payment" && editingPayment ? `/api/payments/${encodeURIComponent(editingPayment.id)}` : "/api/payments", data, mode === "edit-payment" ? "PATCH" : "POST")} />}
  </div>{mode === "customer-quote" && selected?.kind === "bakery" && <CustomerQuoteModal order={selected} profile={bakeryProfile} editProfile={() => setMode("bakery-profile")} close={() => setMode(null)}/>}{mode === "bakery-profile" && <BakeryProfileModal profile={bakeryProfile} close={() => setMode(null)} saved={(profile) => { setBakeryProfile(profile); setProfileError(""); setMode(null); }}/>}{selected && mode !== "customer-quote" && <EventReport event={selected} />}</>;
}

function Metric({ icon, label, value, note, tone }: { icon: React.ReactNode; label: string; value: string; note: string; tone: string }) {
  return <div className="metric-card"><div className={`metric-icon ${tone}`}>{icon}</div><span>{label}</span><strong>{value}</strong><small>{note}</small></div>;
}

function BakeryOrderWorkflow({ orders, selected, saving, select, update }: {
  orders: EventRecord[];
  selected: EventRecord;
  saving: boolean;
  select: (id: string) => void;
  update: (status: OrderStatus) => void;
}) {
  const attention = orders.map((order) => ({ order, reason: orderAttention(order, today()) }))
    .filter((item): item is { order: EventRecord; reason: keyof typeof ATTENTION_LABELS } => item.reason !== null)
    .sort((a, b) => a.order.eventDate.localeCompare(b.order.eventDate));
  const balance = metrics(selected).balance;
  return <section className="workflow-card" aria-label="Bakery order workflow">
    <div className="workflow-header"><div><span className="section-kicker">ORDER WORKFLOW</span><h2>From enquiry to delivery</h2><p>Pick an order to update its stage. Delivery alerts use the date saved on each order.</p></div></div>
    <div className="workflow-stages" aria-label="Orders by stage">
      {ORDER_STAGES.map((stage) => {
        const atStage = orders.filter((order) => order.orderStatus === stage);
        return <button key={stage} type="button" className={`workflow-stage ${selected.orderStatus === stage ? "current" : ""}`} disabled={!atStage.length} onClick={() => select(atStage[0].id)}><span>{ORDER_STAGE_LABELS[stage]}</span><strong>{atStage.length}</strong></button>;
      })}
    </div>
    <div className="workflow-selected"><div><strong>{selected.name}</strong><span>Delivery {prettyDate(selected.eventDate)} · {balance > 0 ? `${currency(balance)} balance due` : "Paid in full"}</span></div><label htmlFor="order-stage">Stage<select id="order-stage" value={selected.orderStatus} disabled={saving} onChange={(event) => update(event.target.value as OrderStatus)}>{ORDER_STAGES.map((stage) => <option value={stage} key={stage}>{ORDER_STAGE_LABELS[stage]}</option>)}</select></label></div>
    {attention.length > 0 && <div className="workflow-attention"><div className="workflow-attention-title"><strong>Needs attention</strong><span>{attention.length} {attention.length === 1 ? "order" : "orders"}</span></div><div className="attention-list">{attention.map(({ order, reason }) => <button key={order.id} type="button" className="attention-item" onClick={() => select(order.id)}><span className={`attention-tag ${reason}`}>{ATTENTION_LABELS[reason]}</span><strong>{order.name}</strong><small>{reason === "payment_due" ? `${currency(Math.max(0, metrics(order).balance))} unpaid` : `Delivery ${prettyDate(order.eventDate)}`} · {ORDER_STAGE_LABELS[order.orderStatus]}</small><ArrowRight size={15}/></button>)}</div></div>}
  </section>;
}

function EventModal({ kind, eventRecord, error, close, saving, submit }: {
  kind: BusinessKind;
  eventRecord: EventRecord | null;
  error: string;
  close: () => void;
  saving: boolean;
  submit: (data: unknown) => void;
}) {
  const recordKind = eventRecord?.kind ?? kind;
  const isBakery = recordKind === "bakery";
  const categories = categoriesFor(recordKind);
  const [name, setName] = useState(eventRecord?.name ?? "");
  const [client, setClient] = useState(eventRecord?.client ?? "");
  const [eventDate, setDate] = useState(eventRecord?.eventDate ?? today());
  const [quote, setQuote] = useState(eventRecord ? String(eventRecord.quotePaise / 100) : "");
  const [orderDescription, setOrderDescription] = useState(eventRecord?.orderDescription ?? "");
  const [quantity, setQuantity] = useState(String(eventRecord?.quantity ?? 1));
  const [fulfillment, setFulfillment] = useState<Fulfillment>(eventRecord?.fulfillment ?? "delivery");
  const [fulfillmentTime, setFulfillmentTime] = useState(eventRecord?.fulfillmentTime ?? "");
  const [depositRequired, setDepositRequired] = useState(eventRecord ? String(eventRecord.depositRequiredPaise / 100) : "");
  const [targetMarginPct, setTargetMarginPct] = useState(String(eventRecord?.targetMarginPct ?? 30));
  const [budgets, setBudgets] = useState<Record<string, string>>(Object.fromEntries(categories.map((category) => [category,
    eventRecord ? String((eventRecord.budgets.find((row) => row.category === category)?.plannedPaise ?? 0) / 100) : ""] )));
  const planned = categories.reduce((sum, category) => sum + (Number(budgets[category]) || 0), 0);
  const quotePaise = Math.round((Number(quote) || 0) * 100);
  const plannedPaise = Math.round(planned * 100);
  const marginPct = quotePaise > 0 ? Math.round(((quotePaise - plannedPaise) / quotePaise) * 100) : null;
  const belowTarget = isBakery && belowMarginTarget(quotePaise, plannedPaise, Number(targetMarginPct));
  function onSubmit(event: FormEvent) {
    event.preventDefault();
    submit({ kind: recordKind, name, client, eventDate, quote: Number(quote),
      ...(isBakery ? { orderDescription, quantity: Number(quantity), fulfillment, fulfillmentTime,
        depositRequired: Number(depositRequired) || 0, targetMarginPct: Number(targetMarginPct) } : {}),
      budgets: Object.fromEntries(categories.map((category) => [category, Number(budgets[category]) || 0])) });
  }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <form className="modal" onSubmit={onSubmit}>
      <div className="modal-header"><div>
        <span className="section-kicker">{isBakery ? eventRecord ? "EDIT ORDER" : "NEW BAKERY ORDER" : eventRecord ? "EDIT EVENT" : "NEW EVENT"}</span>
        <h2>{eventRecord ? isBakery ? "Edit order & costs" : "Edit event & budgets" : "Plan your profit"}</h2>
        <p>{isBakery ? "Price this custom order before you commit to it." : "Start with your quote and estimated costs."}</p>
      </div><button type="button" className="icon-button" onClick={close} aria-label="Close"><X size={20}/></button></div>
      {error && <div role="alert" className="modal-error">{error}</div>}
      <div className="modal-body">
        <div className="field"><label htmlFor="event-name">{isBakery ? "Order name" : "Event name"}</label><input id="event-name" required maxLength={100} placeholder={isBakery ? "e.g. Chocolate birthday cake" : "e.g. Sharma wedding reception"} value={name} onChange={(event) => setName(event.target.value)}/></div>
        <div className="two-fields">
          <div className="field"><label htmlFor="client">{isBakery ? "Customer" : "Client"} <span>optional</span></label><input id="client" maxLength={100} placeholder={isBakery ? "Customer name" : "Client name"} value={client} onChange={(event) => setClient(event.target.value)}/></div>
          <div className="field"><label htmlFor="event-date">{isBakery ? "Delivery date" : "Event date"}</label><input id="event-date" type="date" required value={eventDate} onChange={(event) => setDate(event.target.value)}/></div>
        </div>
        {isBakery && <><div className="field"><label htmlFor="order-description">Order details <span>shown to customer</span></label><textarea id="order-description" maxLength={1000} rows={3} placeholder="Cake flavour, size, design, message, or other agreed details" value={orderDescription} onChange={(event) => setOrderDescription(event.target.value)}/></div><div className="two-fields"><div className="field"><label htmlFor="order-quantity">Quantity</label><input id="order-quantity" type="number" min="1" max="999" step="1" required value={quantity} onChange={(event) => setQuantity(event.target.value)}/></div><div className="field"><label htmlFor="fulfillment">Fulfilment</label><select id="fulfillment" value={fulfillment} onChange={(event) => setFulfillment(event.target.value as Fulfillment)}><option value="delivery">Delivery</option><option value="pickup">Pickup</option></select></div></div><div className="field"><label htmlFor="fulfillment-time">{fulfillment === "pickup" ? "Pickup" : "Delivery"} time <span>optional</span></label><input id="fulfillment-time" type="time" value={fulfillmentTime} onChange={(event) => setFulfillmentTime(event.target.value)}/></div></>}
        <div className="field"><label htmlFor="quote">{isBakery ? "Selling price (₹)" : "Client quote (₹)"}</label><input id="quote" type="number" min="1" step="0.01" required placeholder={isBakery ? "2500" : "50000"} value={quote} onChange={(event) => setQuote(event.target.value)}/></div>
        {isBakery && <div className="two-fields"><div className="field"><label htmlFor="deposit-required">Deposit to confirm (₹)</label><input id="deposit-required" type="number" min="0" max={quote || undefined} step="0.01" placeholder="0" value={depositRequired} onChange={(event) => setDepositRequired(event.target.value)}/></div><div className="field"><label htmlFor="target-margin">Minimum margin target (%) <span>private</span></label><input id="target-margin" type="number" min="0" max="100" step="1" required value={targetMarginPct} onChange={(event) => setTargetMarginPct(event.target.value)}/></div></div>}
        <div className="modal-divider"/>
        <div className="budget-title"><div><strong>Planned costs</strong><span>Estimate each category in rupees</span></div><span>{currency(Math.round(planned * 100))}</span></div>
        <div className="budget-grid">{categories.map((category) => <div className="field" key={category}><label htmlFor={`budget-${category}`}>{category}</label><input id={`budget-${category}`} type="number" min="0" step="0.01" placeholder="0" value={budgets[category]} onChange={(event) => setBudgets({ ...budgets, [category]: event.target.value })}/></div>)}</div>
        <div className="estimate"><span>Initial estimated profit</span><strong>{currency(Math.round(((Number(quote) || 0) - planned) * 100))}</strong></div>
        {isBakery && quotePaise > 0 && <div className={`margin-guidance ${belowTarget ? "below-target" : ""}`} role="status"><strong>{marginPct}% estimated margin {belowTarget ? "· Below your target" : "· Meets your target"}</strong><span>Based on planned costs. Your target is {targetMarginPct || 0}% and stays private.</span></div>}
      </div>
      <div className="modal-actions"><button type="button" className="cancel-button" onClick={close}>Cancel</button><button className="primary-button" type="submit" disabled={saving}>{saving ? "Saving…" : eventRecord ? "Save changes" : isBakery ? "Create order" : "Create event"} <ArrowRight size={17}/></button></div>
    </form>
  </div>;
}

function ExpenseModal({ kind, eventName, eventId, expense, commitment, error, close, saving, submit }: {
  kind: BusinessKind;
  eventName: string;
  eventId: string;
  expense?: EventRecord["expenses"][number];
  commitment?: EventRecord["commitments"][number];
  error: string;
  close: () => void;
  saving: boolean;
  submit: (data: unknown) => void;
}) {
  const categories = categoriesFor(kind);
  const [description, setDescription] = useState(expense?.description ?? (commitment ? `Payment to ${commitment.vendor}` : ""));
  const [category, setCategory] = useState<Category>(commitment?.category ?? expense?.category ?? categories[0]);
  const [amount, setAmount] = useState(expense ? String(expense.amountPaise / 100) : "");
  const [spentOn, setSpentOn] = useState(expense?.spentOn ?? today());
  function onSubmit(event: FormEvent) {
    event.preventDefault();
    submit({ eventId, commitmentId: commitment?.id ?? null, description, category, amount: Number(amount), spentOn });
  }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <form className="modal compact" onSubmit={onSubmit}>
      <div className="modal-header"><div><span className="section-kicker">{commitment ? kind === "bakery" ? "SUPPLIER PAYMENT" : "VENDOR PAYMENT" : expense ? "CORRECT A COST" : "RECORD A COST"}</span><h2>{expense ? "Edit expense" : commitment ? kind === "bakery" ? "Record supplier payment" : "Record vendor payment" : "Add expense"}</h2><p>{eventName}</p></div><button type="button" className="icon-button" onClick={close} aria-label="Close"><X size={20}/></button></div>
      {error && <div role="alert" className="modal-error">{error}</div>}
      <div className="modal-body">
        {commitment && <p className="payment-help">This payment reduces what you still owe {commitment.vendor} and appears once in Expenses.</p>}
        <div className="field"><label htmlFor="description">What did you pay for?</label><input id="description" required maxLength={160} placeholder={kind === "bakery" ? "e.g. Chocolate and cake boxes" : "e.g. Fresh marigold flowers"} value={description} onChange={(event) => setDescription(event.target.value)}/></div>
        <div className="two-fields"><div className="field"><label htmlFor="category">Category</label><select id="category" value={category} disabled={!!commitment} onChange={(event) => setCategory(event.target.value as Category)}>{categories.map((item) => <option key={item}>{item}</option>)}</select></div><div className="field"><label htmlFor="amount">Amount (₹)</label><input id="amount" type="number" min="0.01" step="0.01" required placeholder="2500" value={amount} onChange={(event) => setAmount(event.target.value)}/></div></div>
        <div className="field"><label htmlFor="spent-on">Date paid</label><input id="spent-on" type="date" required value={spentOn} onChange={(event) => setSpentOn(event.target.value)}/></div>
      </div>
      <div className="modal-actions"><button type="button" className="cancel-button" onClick={close}>Cancel</button><button className="primary-button" type="submit" disabled={saving}>{saving ? "Saving…" : expense ? "Save changes" : commitment ? "Record payment" : "Save expense"} <Check size={17}/></button></div>
    </form>
  </div>;
}

function PaymentModal({ kind, eventName, eventId, payment, error, close, saving, submit }: {
  kind: BusinessKind;
  eventName: string;
  eventId: string;
  payment?: EventRecord["payments"][number];
  error: string;
  close: () => void;
  saving: boolean;
  submit: (data: unknown) => void;
}) {
  const [amount, setAmount] = useState(payment ? String(payment.amountPaise / 100) : "");
  const [receivedOn, setReceivedOn] = useState(payment?.receivedOn ?? today());
  const [note, setNote] = useState(payment?.note ?? "");

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    submit({ eventId, amount: Number(amount), receivedOn, note });
  }

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <form className="modal compact" onSubmit={onSubmit}>
      <div className="modal-header">
        <div><span className="section-kicker">{kind === "bakery" ? "CUSTOMER PAYMENTS" : "CLIENT PAYMENTS"}</span><h2>{payment ? "Edit payment" : "Record payment"}</h2><p>{eventName}</p></div>
        <button type="button" className="icon-button" onClick={close} aria-label="Close"><X size={20}/></button>
      </div>
      {error && <div role="alert" className="modal-error">{error}</div>}
      <div className="modal-body">
        <p className="payment-help">Record money already received from your {kind === "bakery" ? "customer" : "client"}. This does not collect a payment.</p>
        <div className="two-fields">
          <div className="field"><label htmlFor="payment-amount">Amount received (₹)</label><input id="payment-amount" type="number" min="0.01" step="0.01" required placeholder="10000" value={amount} onChange={(event) => setAmount(event.target.value)}/></div>
          <div className="field"><label htmlFor="payment-date">Date received</label><input id="payment-date" type="date" required value={receivedOn} onChange={(event) => setReceivedOn(event.target.value)}/></div>
        </div>
        <div className="field"><label htmlFor="payment-note">Note <span>optional</span></label><input id="payment-note" maxLength={160} placeholder="e.g. Booking deposit" value={note} onChange={(event) => setNote(event.target.value)}/></div>
      </div>
      <div className="modal-actions"><button type="button" className="cancel-button" onClick={close}>Cancel</button><button className="primary-button" type="submit" disabled={saving}>{saving ? "Saving…" : payment ? "Save changes" : "Save payment"} <Check size={17}/></button></div>
    </form>
  </div>;
}
