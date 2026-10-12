import { and, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getDb } from "../../../db";
import { commitments, events, expenses } from "../../../db/schema";
import { isCategory, toPaise } from "../../../lib/finance";

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  try {
    const data = await request.json() as Record<string, unknown>;
    const eventId = typeof data.eventId === "string" ? data.eventId : "";
    const description = typeof data.description === "string" ? data.description.trim() : "";
    const commitmentId = typeof data.commitmentId === "string" ? data.commitmentId : null;
    const amountPaise = toPaise(data.amount);
    const spentOn = typeof data.spentOn === "string" ? data.spentOn : "";
    if (!eventId || !description || description.length > 160 || (data.commitmentId != null && !commitmentId)
      || amountPaise === null || amountPaise === 0 || !/^\d{4}-\d{2}-\d{2}$/.test(spentOn)) {
      return Response.json({ error: "Enter a description, category, amount, and date." }, { status: 400 });
    }
    const db = getDb();
    const [owned] = await db.select({ id: events.id }).from(events).where(and(eq(events.id, eventId), eq(events.ownerId, user.userId))).limit(1);
    if (!owned) return Response.json({ error: "Event not found" }, { status: 404 });
    const [commitment] = commitmentId ? await db.select({ category: commitments.category }).from(commitments)
      .where(and(eq(commitments.id, commitmentId), eq(commitments.eventId, eventId))).limit(1) : [];
    if (commitmentId && !commitment) return Response.json({ error: "Vendor commitment not found" }, { status: 404 });
    const category = commitment?.category ?? data.category;
    if (!isCategory(category)) return Response.json({ error: "Choose a valid category." }, { status: 400 });
    await db.insert(expenses).values({ id: crypto.randomUUID(), eventId, commitmentId, description, category, amountPaise, spentOn, createdAt: new Date().toISOString() });
    return Response.json({ ok: true }, { status: 201 });
  } catch {
    return Response.json({ error: "Could not save expense. Please try again." }, { status: 500 });
  }
}
