import { and, eq, isNull } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getDb } from "../../../db";
import { events, payments } from "../../../db/schema";
import { toPaise } from "../../../lib/finance";

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  try {
    const data = await request.json() as Record<string, unknown>;
    const eventId = typeof data.eventId === "string" ? data.eventId : "";
    const amountPaise = toPaise(data.amount);
    const receivedOn = typeof data.receivedOn === "string" ? data.receivedOn : "";
    const note = typeof data.note === "string" ? data.note.trim() : "";
    if (!eventId || amountPaise === null || amountPaise === 0 || note.length > 160
      || !/^\d{4}-\d{2}-\d{2}$/.test(receivedOn)
      || Number.isNaN(Date.parse(`${receivedOn}T12:00:00Z`))) {
      return Response.json({ error: "Enter a valid amount and date. Notes can be up to 160 characters." }, { status: 400 });
    }

    const db = getDb();
    const [owned] = await db.select({ id: events.id }).from(events)
      .where(and(eq(events.id, eventId), eq(events.ownerId, user.userId), isNull(events.archivedAt))).limit(1);
    if (!owned) return Response.json({ error: "Event not found" }, { status: 404 });

    await db.insert(payments).values({ id: crypto.randomUUID(), eventId, amountPaise, receivedOn, note, createdAt: new Date().toISOString() });
    return Response.json({ ok: true }, { status: 201 });
  } catch {
    return Response.json({ error: "Could not save payment. Please try again." }, { status: 500 });
  }
}
