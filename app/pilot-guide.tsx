"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Check, MessageSquare, X } from "lucide-react";
import type { EventRecord } from "../lib/finance";
import { PILOT_STAGES, PILOT_STAGE_LABELS, type PilotStage } from "../lib/pilot-feedback";

export default function PilotGuide({ orders, createOrder }: { orders: EventRecord[]; createOrder: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [stage, setStage] = useState<PilotStage>("pricing");
  const [easeScore, setEaseScore] = useState(0);
  const [blocker, setBlocker] = useState("");
  const [workedWell, setWorkedWell] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [joinedAt, setJoinedAt] = useState<string | null | undefined>(undefined);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");
  const delivered = joinedAt ? orders.filter((order) => order.createdAt >= joinedAt && order.orderStatus === "delivered").length : 0;

  useEffect(() => {
    let active = true;
    void fetch("/api/pilot-participation", { cache: "no-store" }).then(async (response) => {
      const data = await response.json() as { joinedAt?: string | null; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not load pilot status.");
      if (active) setJoinedAt(data.joinedAt ?? null);
    }).catch(() => { if (active) setJoinError("Could not load pilot status. Refresh to try again."); });
    return () => { active = false; };
  }, []);

  async function changeParticipation(method: "POST" | "DELETE") {
    setJoining(true);
    setJoinError("");
    try {
      const response = await fetch("/api/pilot-participation", { method });
      const data = await response.json() as { joinedAt?: string | null; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not update pilot status.");
      setJoinedAt(data.joinedAt ?? null);
    } catch (cause) {
      setJoinError(cause instanceof Error ? cause.message : "Could not update pilot status.");
    } finally { setJoining(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/pilot-feedback", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage, easeScore, blocker, workedWell }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not send feedback.");
      setSent(true);
      setBlocker("");
      setWorkedWell("");
      setEaseScore(0);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send feedback.");
    } finally { setSaving(false); }
  }

  return <>
    <section className="pilot-card" aria-label="Bakery pilot guide">
      <div className="pilot-intro"><span className="section-kicker">BAKERY BETA · TWO-ORDER PILOT</span><h2>Try it with two real orders</h2><p>Use the full flow with your next two custom orders. Tell us where it slows you down so we can improve it.</p></div>
      <div className="pilot-progress"><strong>{joinedAt ? `${Math.min(delivered, 2)} of 2` : "Ready when you are"}</strong><span>{joinedAt ? "pilot orders marked delivered" : "join to track your pilot orders"}</span><div className="progress"><span style={{ width: `${Math.min(delivered, 2) * 50}%` }}/></div></div>
      <ol className="pilot-steps">
        <li><span>1</span><div><strong>Price and share</strong><p>Create an order, estimate costs, and send the customer quote.</p></div></li>
        <li><span>2</span><div><strong>Track the real work</strong><p>Record ingredient spend and customer payments as they happen.</p></div></li>
        <li><span>3</span><div><strong>Finish and reflect</strong><p>Mark each order delivered, then tell us what was difficult.</p></div></li>
      </ol>
      <div className="pilot-actions"><button type="button" className="primary-button" disabled={joinedAt === undefined || joining} onClick={() => void changeParticipation(joinedAt ? "DELETE" : "POST")}>{joining ? "Saving…" : joinedAt ? "Leave pilot" : "Join two-order pilot"}</button><button type="button" className="outline-button" onClick={createOrder}>Start an order <ArrowRight size={16}/></button><button type="button" className="text-button" onClick={() => { setSent(false); setError(""); setShowForm(true); }}><MessageSquare size={16}/> Give feedback</button></div>
      {joinError && <p className="pilot-join-error" role="alert">{joinError}</p>}
      <p className="pilot-note">Joining shows the app owner your sign-in email and counts of bakery orders created after joining and marked delivered. The pilot view does not show order details or finances. You can leave the pilot anytime; feedback you already sent remains. The count does not verify a quote was sent or payment made.</p>
    </section>
    {showForm && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowForm(false); }}><div className="modal compact" role="dialog" aria-modal="true" aria-label="Bakery pilot feedback"><div className="modal-header"><div><span className="section-kicker">BAKERY PILOT</span><h2>Tell us what happened</h2><p>Send a note anytime, even before finishing two orders.</p></div><button type="button" className="icon-button" onClick={() => setShowForm(false)} aria-label="Close"><X size={20}/></button></div>{sent ? <div className="pilot-sent"><Check size={22}/><strong>Thanks, your feedback was saved.</strong><p>You can send another note if you run into a different issue.</p><button type="button" className="primary-button" onClick={() => setShowForm(false)}>Done</button></div> : <form onSubmit={(event) => void submit(event)}><div className="modal-body pilot-feedback-fields">{error && <div className="modal-error" role="alert">{error}</div>}<div className="field"><label htmlFor="pilot-stage">Which step were you on?</label><select id="pilot-stage" value={stage} onChange={(event) => setStage(event.target.value as PilotStage)}>{PILOT_STAGES.map((item) => <option key={item} value={item}>{PILOT_STAGE_LABELS[item]}</option>)}</select></div><fieldset className="pilot-rating"><legend>How easy was that step?</legend><div>{[1, 2, 3, 4, 5].map((score) => <label key={score}><input type="radio" name="ease" value={score} checked={easeScore === score} onChange={() => setEaseScore(score)} required/><span>{score}</span></label>)}</div><small>1 = very difficult · 5 = very easy</small></fieldset><div className="field"><label htmlFor="pilot-blocker">What was confusing or slow?</label><textarea id="pilot-blocker" value={blocker} onChange={(event) => setBlocker(event.target.value)} required minLength={10} maxLength={1200} placeholder="Tell us what you tried and what happened"/></div><div className="field"><label htmlFor="pilot-worked">What worked well? <span>optional</span></label><textarea id="pilot-worked" value={workedWell} onChange={(event) => setWorkedWell(event.target.value)} maxLength={1200}/></div><p className="pilot-privacy">The app owner will receive your selected step, ease score, note, sign-in email, and count of delivered bakery orders at submission. Order details and finances are not included.</p></div><div className="modal-actions"><button type="button" className="cancel-button" onClick={() => setShowForm(false)}>Cancel</button><button type="submit" className="primary-button" disabled={saving || easeScore === 0}>{saving ? "Sending…" : "Send feedback"}</button></div></form>}</div></div>}
  </>;
}
