import { and, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getDb } from "../../../db";
import { events, expenses } from "../../../db/schema";
import { isCategory, toPaise } from "../../../lib/finance";

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  try {
    const data = await request.json() as Record<string, unknown>;
    const eventId = typeof data.eventId === "string" ? data.eventId : "";
    const description = typeof data.description === "string" ? data.description.trim() : "";
    const category = data.category;
    const amountPaise = toPaise(data.amount);
    const spentOn = typeof data.spentOn === "string" ? data.spentOn : "";
    if (!eventId || !description || description.length > 160 || !isCategory(category) || amountPaise === null || amountPaise === 0 || !/^\d{4}-\d{2}-\d{2}$/.test(spentOn)) {
      return Response.json({ error: "Enter a description, category, amount, and date." }, { status: 400 });
    }
    const db = getDb();
    const [owned] = await db.select({ id: events.id }).from(events).where(and(eq(events.id, eventId), eq(events.ownerId, user.userId))).limit(1);
    if (!owned) return Response.json({ error: "Event not found" }, { status: 404 });
    await db.insert(expenses).values({ id: crypto.randomUUID(), eventId, description, category, amountPaise, spentOn, createdAt: new Date().toISOString() });
    return Response.json({ ok: true }, { status: 201 });
  } catch {
    return Response.json({ error: "Could not save expense. Please try again." }, { status: 500 });
  }
}
