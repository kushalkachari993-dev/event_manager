import { and, eq, gte } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getDb } from "../../../db";
import { events, pilotFeedback } from "../../../db/schema";
import { parsePilotFeedback } from "../../../lib/pilot-feedback";

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return Response.json({ error: "Send feedback as JSON." }, { status: 415 });
  }
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "Invalid origin." }, { status: 403 });
  try {
    const body = await request.text();
    if (body.length > 5000) return Response.json({ error: "Feedback is too long." }, { status: 413 });
    let parsed: unknown;
    try { parsed = JSON.parse(body); } catch { return Response.json({ error: "Invalid feedback format." }, { status: 400 }); }
    const input = parsePilotFeedback(parsed);
    if (!input) return Response.json({ error: "Choose a step and ease score, then describe the main difficulty in at least 10 characters." }, { status: 400 });
    const db = getDb();
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const recent = await db.select({ id: pilotFeedback.id }).from(pilotFeedback)
      .where(and(eq(pilotFeedback.ownerId, user.userId), gte(pilotFeedback.createdAt, dayStart.toISOString()))).limit(5);
    if (recent.length >= 5) return Response.json({ error: "You have sent five notes today. Please try again tomorrow." }, { status: 429 });
    const delivered = await db.select({ id: events.id }).from(events)
      .where(and(eq(events.ownerId, user.userId), eq(events.kind, "bakery"), eq(events.orderStatus, "delivered")));
    await db.insert(pilotFeedback).values({
      id: crypto.randomUUID(), ownerId: user.userId, email: user.email,
      ...input, deliveredOrders: delivered.length, createdAt: new Date().toISOString(),
    });
    return Response.json({ ok: true }, { status: 201 });
  } catch {
    return Response.json({ error: "Could not save your feedback. Please try again." }, { status: 500 });
  }
}
