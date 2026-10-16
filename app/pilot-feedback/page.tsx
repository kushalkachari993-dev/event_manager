/* eslint-disable @next/next/no-html-link-for-pages -- A plain link avoids Vinext's next/link dev-runtime hook failure here. */
import { env } from "cloudflare:workers";
import { desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { requireChatGPTUser } from "../chatgpt-auth";
import { getDb } from "../../db";
import { pilotFeedback } from "../../db/schema";
import { PILOT_STAGE_LABELS, type PilotStage } from "../../lib/pilot-feedback";

export const dynamic = "force-dynamic";

export default async function PilotFeedbackPage() {
  const user = await requireChatGPTUser("/pilot-feedback");
  const adminId = (env as unknown as { PILOT_ADMIN_USER_ID?: string }).PILOT_ADMIN_USER_ID;
  if (!adminId || user.userId !== adminId) notFound();
  const notes = await getDb().select().from(pilotFeedback).orderBy(desc(pilotFeedback.createdAt)).limit(500);
  const participants = new Set(notes.map((note) => note.ownerId)).size;
  const average = notes.length ? (notes.reduce((sum, note) => sum + note.easeScore, 0) / notes.length).toFixed(1) : "—";

  return <main className="pilot-admin-page"><div className="pilot-admin-wrap"><a href="/" className="pilot-back">← Back to workspace</a><span className="section-kicker">OWNER VIEW</span><h1>Bakery pilot feedback</h1><p>Notes from signed-in pilot users. The latest 500 are shown; no customer order details or financial figures are included.</p><div className="pilot-admin-stats"><div><strong>{notes.length}</strong><span>notes</span></div><div><strong>{participants}</strong><span>participants</span></div><div><strong>{average}</strong><span>average ease / 5</span></div></div>{notes.length ? <div className="pilot-feedback-list">{notes.map((note) => <article key={note.id} className="pilot-feedback-item"><div className="pilot-feedback-head"><div><strong>{note.email}</strong><span>{new Date(note.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}</span></div><div className="pilot-feedback-badges"><span>{PILOT_STAGE_LABELS[note.stage as PilotStage] ?? "Other"}</span><span>Ease {note.easeScore}/5</span><span>{note.deliveredOrders} delivered</span></div></div><h2>Main difficulty</h2><p>{note.blocker}</p>{note.workedWell && <><h2>What worked</h2><p>{note.workedWell}</p></>}</article>)}</div> : <div className="pilot-admin-empty">No feedback yet. Invite a few bakery owners to use the app on real orders.</div>}</div></main>;
}
