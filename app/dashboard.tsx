"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowDownRight, ArrowRight, CalendarDays, Check, ChevronDown, CircleHelp, IndianRupee, Layers3, Plus, Sparkles, TrendingUp, Wallet, X } from "lucide-react";
import { CATEGORIES, metrics, type Category, type EventRecord } from "../lib/finance";

const currency = (paise: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100);
const today = () => new Date().toISOString().slice(0, 10);
const prettyDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

type Mode = "event" | "expense" | null;

export default function Dashboard({ displayName }: { displayName: string }) {
  const [items, setItems] = useState<EventRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/events", { cache: "no-store" });
      const data = await response.json() as { events: EventRecord[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not load events");
      setItems(data.events);
      setSelectedId((current) => current && data.events.some((event: EventRecord) => event.id === current) ? current : data.events[0]?.id ?? null);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load events");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const selected = items.find((item) => item.id === selectedId) ?? null;
  const selectedMetrics = selected ? metrics(selected) : null;
  const all = useMemo(() => items.map(metrics), [items]);
  const totals = { quote: items.reduce((n, item) => n + item.quotePaise, 0), forecast: all.reduce((n, item) => n + item.projectedProfit, 0), spent: all.reduce((n, item) => n + item.spent, 0) };
  const firstName = displayName.split(/[ @]/)[0] || "there";

  async function submit(path: string, payload: unknown) {
    setSaving(true); setError("");
    try {
      const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json() as { id?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not save");
      await load();
      if (data.id) setSelectedId(data.id);
      setMode(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save");
    } finally { setSaving(false); }
  }

  return <div className="shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark"><Layers3 size={20} strokeWidth={2.4}/></span><span>event<span className="brand-light">profit</span><b>.</b></span></div>
      <div className="workspace-label">WORKSPACE</div>
      <nav className="side-nav"><div className="nav-item active"><span className="nav-dot"/> Overview</div><div className="nav-item muted"><CalendarDays size={18}/> Events</div></nav>
      <div className="side-spacer"/>
      <div className="side-note"><div className="side-note-icon"><Sparkles size={17}/></div><strong>Know your number</strong><p>Track every cost while there is still time to protect your profit.</p></div>
      <div className="profile"><div className="avatar">{firstName.slice(0, 1).toUpperCase()}</div><div><strong>{firstName}</strong><span>Private workspace</span></div><ChevronDown size={15}/></div>
    </aside>

    <main className="main">
      <header className="topbar"><div className="crumb">Workspace <span>/</span> <strong>Overview</strong></div><div className="topbar-right"><span className="secure-pill"><span/> Private dashboard</span><div className="small-avatar">{firstName.slice(0, 1).toUpperCase()}</div></div></header>
      <div className="content">
        <section className="heading"><div><div className="eyebrow">YOUR FINANCIAL CONTROL ROOM</div><h1>Good morning, {firstName} <span className="wave">✳</span></h1><p>Keep your event costs in view and your margins on track.</p></div><button className="primary-button" onClick={() => { setError(""); setMode("event"); }}><Plus size={18}/> New event</button></section>
        {error && <div role="alert" className="error-banner">{error}<button onClick={() => setError("")} aria-label="Dismiss error"><X size={16}/></button></div>}
        {loading ? <div className="loading">Loading your workspace…</div> : <>
          <section className="metric-grid">
            <Metric icon={<CalendarDays size={20}/>} label="Active events" value={String(items.length)} note="Events in your workspace" tone="purple" />
            <Metric icon={<IndianRupee size={20}/>} label="Total quoted" value={currency(totals.quote)} note="Across all events" tone="blue" />
            <Metric icon={<TrendingUp size={20}/>} label="Projected profit" value={currency(totals.forecast)} note="Based on planned & actual costs" tone="green" />
            <Metric icon={<Wallet size={20}/>} label="Expenses logged" value={currency(totals.spent)} note="Actual spend to date" tone="orange" />
          </section>

          {items.length === 0 ? <div className="empty-layout"><div className="empty-card"><div className="empty-icon"><Layers3 size={30}/></div><span className="section-kicker">START HERE</span><h2>Make your next event more profitable.</h2><p>Add an event with your quote and category budgets. Then record expenses as they happen to see your projected profit update.</p><button className="primary-button" onClick={() => setMode("event")}><Plus size={18}/> Create first event</button></div><div className="how-card"><span className="section-kicker">HOW IT WORKS</span><div className="how-row"><span>01</span><div><strong>Plan</strong><p>Set a quote and budget by category.</p></div></div><div className="how-row"><span>02</span><div><strong>Track</strong><p>Log each actual expense.</p></div></div><div className="how-row"><span>03</span><div><strong>Protect</strong><p>Spot overruns before they eat your margin.</p></div></div></div></div> : <>
            <div className="section-heading"><div><span className="section-kicker">YOUR PORTFOLIO</span><h2>Events <span className="count">{items.length}</span></h2></div><span className="subtle">Select an event to inspect its costs</span></div>
            <div className="event-tabs">{items.map((item) => { const m = metrics(item); return <button key={item.id} className={`event-tab ${selectedId === item.id ? "selected" : ""}`} onClick={() => setSelectedId(item.id)}><span className="event-tab-icon"><CalendarDays size={18}/></span><span><strong>{item.name}</strong><small>{prettyDate(item.eventDate)} · {currency(item.quotePaise)} quote</small></span><span className={`tab-profit ${m.projectedProfit < 0 ? "negative" : ""}`}>{currency(m.projectedProfit)} <ArrowRight size={16}/></span></button>; })}</div>
            {selected && selectedMetrics && <div className="detail-grid"><section className="detail-card"><div className="detail-top"><div><span className="section-kicker">PROFIT FORECAST</span><h2>{selected.name}</h2><p>{selected.client || "Client not specified"} <span>·</span> {prettyDate(selected.eventDate)}</p></div><div className={`status ${selectedMetrics.projectedProfit < 0 ? "at-risk" : ""}`}><span/> {selectedMetrics.projectedProfit < 0 ? "At risk" : "On track"}</div></div><div className="profit-feature"><div><span>Projected profit</span><strong className={selectedMetrics.projectedProfit < 0 ? "negative-text" : ""}>{currency(selectedMetrics.projectedProfit)}</strong><small>{selectedMetrics.margin}% projected margin</small></div><div className="profit-graphic"><TrendingUp size={46} strokeWidth={1.4}/></div></div><div className="finance-row"><div><span>Client quote</span><strong>{currency(selected.quotePaise)}</strong></div><div><span>Planned costs</span><strong>{currency(selectedMetrics.planned)}</strong></div><div><span>Spent so far</span><strong>{currency(selectedMetrics.spent)}</strong></div><div><span>Projected cost</span><strong>{currency(selectedMetrics.projectedCost)}</strong></div></div><div className="formula"><CircleHelp size={16}/><span>Forecast cost uses the higher of budget or actual spend in each category.</span></div></section>
            <section className="detail-card cost-card"><div className="cost-heading"><div><span className="section-kicker">WHERE THE MONEY GOES</span><h2>Cost breakdown</h2></div><button className="outline-button" onClick={() => { setError(""); setMode("expense"); }}><Plus size={16}/> Add expense</button></div><div className="category-list">{CATEGORIES.map((category) => { const planned = selected.budgets.find((b) => b.category === category)?.plannedPaise ?? 0; const actual = selected.expenses.filter((e) => e.category === category).reduce((n, e) => n + e.amountPaise, 0); const progress = planned ? Math.min(100, (actual / planned) * 100) : actual ? 100 : 0; return <div className="category-row" key={category}><div className="category-line"><strong>{category}</strong><span className={actual > planned ? "overrun" : ""}>{currency(actual)} <em>/ {currency(planned)}</em></span></div><div className="progress"><span className={actual > planned ? "overrun-fill" : ""} style={{ width: `${progress}%` }}/></div></div>; })}</div></section></div>}
            {selected && <section className="expenses-card"><div className="expenses-heading"><div><span className="section-kicker">ACTIVITY</span><h2>Recent expenses</h2></div><button className="text-button" onClick={() => setMode("expense")}>Add expense <ArrowRight size={16}/></button></div>{selected.expenses.length ? <div className="expense-list">{selected.expenses.slice(0, 8).map((expense) => <div className="expense-row" key={expense.id}><div className="expense-icon"><ArrowDownRight size={18}/></div><div className="expense-description"><strong>{expense.description}</strong><span>{expense.category} · {prettyDate(expense.spentOn)}</span></div><strong>{currency(expense.amountPaise)}</strong></div>)}</div> : <div className="no-expenses">No expenses logged yet. Add one as soon as you make a purchase.</div>}</section>}
          </>}
        </>}
      </div>
    </main>
    {mode === "event" && <EventModal close={() => setMode(null)} saving={saving} submit={(data) => submit("/api/events", data)} />}
    {mode === "expense" && selected && <ExpenseModal eventName={selected.name} eventId={selected.id} close={() => setMode(null)} saving={saving} submit={(data) => submit("/api/expenses", data)} />}
  </div>;
}

function Metric({ icon, label, value, note, tone }: { icon: React.ReactNode; label: string; value: string; note: string; tone: string }) {
  return <div className="metric-card"><div className={`metric-icon ${tone}`}>{icon}</div><span>{label}</span><strong>{value}</strong><small>{note}</small></div>;
}

function EventModal({ close, saving, submit }: { close: () => void; saving: boolean; submit: (data: unknown) => void }) {
  const [name, setName] = useState(""); const [client, setClient] = useState(""); const [eventDate, setDate] = useState(today()); const [quote, setQuote] = useState("");
  const [budgets, setBudgets] = useState<Record<Category, string>>(Object.fromEntries(CATEGORIES.map((category) => [category, ""])) as Record<Category, string>);
  const planned = CATEGORIES.reduce((n, c) => n + (Number(budgets[c]) || 0), 0);
  function onSubmit(event: FormEvent) { event.preventDefault(); submit({ name, client, eventDate, quote: Number(quote), budgets: Object.fromEntries(CATEGORIES.map((category) => [category, Number(budgets[category]) || 0])) }); }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><form className="modal" onSubmit={onSubmit}><div className="modal-header"><div><span className="section-kicker">NEW EVENT</span><h2>Plan your profit</h2><p>Start with your quote and estimated costs.</p></div><button type="button" className="icon-button" onClick={close} aria-label="Close"><X size={20}/></button></div><div className="modal-body"><div className="field"><label htmlFor="event-name">Event name</label><input id="event-name" required maxLength={100} placeholder="e.g. Sharma wedding reception" value={name} onChange={(e) => setName(e.target.value)}/></div><div className="two-fields"><div className="field"><label htmlFor="client">Client <span>optional</span></label><input id="client" maxLength={100} placeholder="Client name" value={client} onChange={(e) => setClient(e.target.value)}/></div><div className="field"><label htmlFor="event-date">Event date</label><input id="event-date" type="date" required value={eventDate} onChange={(e) => setDate(e.target.value)}/></div></div><div className="field"><label htmlFor="quote">Client quote (₹)</label><input id="quote" type="number" min="1" step="0.01" required placeholder="50000" value={quote} onChange={(e) => setQuote(e.target.value)}/></div><div className="modal-divider"/><div className="budget-title"><div><strong>Planned costs</strong><span>Estimate each category in rupees</span></div><span>{currency(Math.round(planned * 100))}</span></div><div className="budget-grid">{CATEGORIES.map((category) => <div className="field" key={category}><label htmlFor={`budget-${category}`}>{category}</label><input id={`budget-${category}`} type="number" min="0" step="0.01" placeholder="0" value={budgets[category]} onChange={(e) => setBudgets({ ...budgets, [category]: e.target.value })}/></div>)}</div><div className="estimate"><span>Initial estimated profit</span><strong>{currency(Math.round(((Number(quote) || 0) - planned) * 100))}</strong></div></div><div className="modal-actions"><button type="button" className="cancel-button" onClick={close}>Cancel</button><button className="primary-button" type="submit" disabled={saving}>{saving ? "Creating…" : "Create event"} <ArrowRight size={17}/></button></div></form></div>;
}

function ExpenseModal({ eventName, eventId, close, saving, submit }: { eventName: string; eventId: string; close: () => void; saving: boolean; submit: (data: unknown) => void }) {
  const [description, setDescription] = useState(""); const [category, setCategory] = useState<Category>("Flowers"); const [amount, setAmount] = useState(""); const [spentOn, setSpentOn] = useState(today());
  function onSubmit(event: FormEvent) { event.preventDefault(); submit({ eventId, description, category, amount: Number(amount), spentOn }); }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><form className="modal compact" onSubmit={onSubmit}><div className="modal-header"><div><span className="section-kicker">RECORD A COST</span><h2>Add expense</h2><p>{eventName}</p></div><button type="button" className="icon-button" onClick={close} aria-label="Close"><X size={20}/></button></div><div className="modal-body"><div className="field"><label htmlFor="description">What did you pay for?</label><input id="description" required maxLength={160} placeholder="e.g. Fresh marigold flowers" value={description} onChange={(e) => setDescription(e.target.value)}/></div><div className="two-fields"><div className="field"><label htmlFor="category">Category</label><select id="category" value={category} onChange={(e) => setCategory(e.target.value as Category)}>{CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></div><div className="field"><label htmlFor="amount">Amount (₹)</label><input id="amount" type="number" min="0.01" step="0.01" required placeholder="2500" value={amount} onChange={(e) => setAmount(e.target.value)}/></div></div><div className="field"><label htmlFor="spent-on">Date paid</label><input id="spent-on" type="date" required value={spentOn} onChange={(e) => setSpentOn(e.target.value)}/></div></div><div className="modal-actions"><button type="button" className="cancel-button" onClick={close}>Cancel</button><button className="primary-button" type="submit" disabled={saving}>{saving ? "Saving…" : "Save expense"} <Check size={17}/></button></div></form></div>;
}
