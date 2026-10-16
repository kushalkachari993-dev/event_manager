/* eslint-disable @next/next/no-html-link-for-pages -- A plain link avoids Vinext's next/link dev-runtime hook failure here. */
import { env } from "cloudflare:workers";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { requireChatGPTUser } from "../chatgpt-auth";
import { getDb } from "../../db";
import { events, pilotFeedback, pilotParticipants } from "../../db/schema";
import { PILOT_STAGE_LABELS, type PilotStage } from "../../lib/pilot-feedback";

export const dynamic = "force-dynamic";

function pilotDate(value: string): string {
  return new Date(value).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
}

export default async function PilotFeedbackPage() {
  const user = await requireChatGPTUser("/pilot-feedback");
  const adminId = (env as unknown as { PILOT_ADMIN_USER_ID?: string }).PILOT_ADMIN_USER_ID;
  if (!adminId || user.userId !== adminId) notFound();

  const db = getDb();
  const [cohort, notes] = await Promise.all([
    db.select({
      ownerId: pilotParticipants.ownerId,
      email: pilotParticipants.email,
      joinedAt: pilotParticipants.joinedAt,
      ordersStarted: sql<number>`count(${events.id})`,
      deliveredOrders: sql<number>`sum(case when ${events.orderStatus} = 'delivered' then 1 else 0 end)`,
    }).from(pilotParticipants).leftJoin(events, and(
      eq(events.ownerId, pilotParticipants.ownerId),
      eq(events.kind, "bakery"),
      gte(events.createdAt, pilotParticipants.joinedAt),
    )).groupBy(pilotParticipants.ownerId).orderBy(desc(pilotParticipants.joinedAt)).limit(100),
    db.select().from(pilotFeedback).orderBy(desc(pilotFeedback.createdAt)).limit(500),
  ]);
  const started = cohort.filter((person) => Number(person.ordersStarted) > 0).length;
  const completed = cohort.filter((person) => Number(person.deliveredOrders) >= 2).length;
  const feedbackAuthors = new Set(notes.map((note) => note.ownerId)).size;
  const average = notes.length ? (notes.reduce((sum, note) => sum + note.easeScore, 0) / notes.length).toFixed(1) : "—";

  return <main className="pilot-admin-page"><div className="pilot-admin-wrap">
    <a href="/" className="pilot-back">← Back to workspace</a>
    <span className="section-kicker">OWNER VIEW</span><h1>Bakery pilot</h1>
    <p>Participants join voluntarily. Their row shows sign-in email and counts of bakery orders created after joining and marked delivered. This view does not show order details or financial figures. Up to 100 participants and the latest 500 feedback notes are shown.</p>
    <div className="pilot-admin-stats">
      <div><strong>{cohort.length}</strong><span>joined</span></div>
      <div><strong>{started}</strong><span>started an order</span></div>
      <div><strong>{completed}</strong><span>delivered two orders</span></div>
      <div><strong>{feedbackAuthors}</strong><span>sent feedback</span></div>
      <div><strong>{average}</strong><span>average ease / 5</span></div>
    </div>
    <section className="pilot-admin-section" aria-labelledby="pilot-participants-heading">
      <h2 id="pilot-participants-heading">Pilot participants</h2>
      {cohort.length ? <div className="pilot-participant-list">{cohort.map((person) => <article key={person.ownerId} className="pilot-participant-item"><div><strong>{person.email}</strong><span>Joined {pilotDate(person.joinedAt)}</span></div><div className="pilot-feedback-badges"><span>{Number(person.ordersStarted)} started</span><span>{Number(person.deliveredOrders)} delivered</span></div></article>)}</div> : <div className="pilot-admin-empty">No one has joined yet. Send the pilot invitation to bakery owners you know.</div>}
    </section>
    <section className="pilot-admin-section" aria-labelledby="pilot-notes-heading">
      <h2 id="pilot-notes-heading">Feedback notes</h2>
      {notes.length ? <div className="pilot-feedback-list">{notes.map((note) => <article key={note.id} className="pilot-feedback-item"><div className="pilot-feedback-head"><div><strong>{note.email}</strong><span>{pilotDate(note.createdAt)}</span></div><div className="pilot-feedback-badges"><span>{PILOT_STAGE_LABELS[note.stage as PilotStage] ?? "Other"}</span><span>Ease {note.easeScore}/5</span><span>{note.deliveredOrders} delivered at submission</span></div></div><h3>Main difficulty</h3><p>{note.blocker}</p>{note.workedWell && <><h3>What worked</h3><p>{note.workedWell}</p></>}</article>)}</div> : <div className="pilot-admin-empty">No feedback yet. Ask participants where their first order slowed them down.</div>}
    </section>
  </div></main>;
}
