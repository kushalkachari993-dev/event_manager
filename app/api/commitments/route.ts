import { and, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getDb } from "../../../db";
import { commitments, events } from "../../../db/schema";
import { isCategoryFor, toPaise } from "../../../lib/finance";

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  try {
    const data = await request.json() as Record<string, unknown>;
    const eventId = typeof data.eventId === "string" ? data.eventId : "";
    const vendor = typeof data.vendor === "string" ? data.vendor.trim() : "";
    const category = data.category;
    const agreedPaise = toPaise(data.agreed);
    const dueOn = typeof data.dueOn === "string" ? data.dueOn : "";
    if (!eventId || !vendor || vendor.length > 100 || agreedPaise === null || agreedPaise === 0
      || !/^\d{4}-\d{2}-\d{2}$/.test(dueOn) || Number.isNaN(Date.parse(`${dueOn}T12:00:00Z`))) {
      return Response.json({ error: "Enter a vendor, category, agreed cost, and due date." }, { status: 400 });
    }
    const db = getDb();
    const [owned] = await db.select({ id: events.id, kind: events.kind }).from(events)
      .where(and(eq(events.id, eventId), eq(events.ownerId, user.userId))).limit(1);
    if (!owned) return Response.json({ error: "Event not found" }, { status: 404 });
    if (!isCategoryFor(category, owned.kind === "bakery" ? "bakery" : "event")) return Response.json({ error: "Choose a valid category." }, { status: 400 });
    const id = crypto.randomUUID();
    await db.insert(commitments).values({ id, eventId, vendor, category, agreedPaise, dueOn, createdAt: new Date().toISOString() });
    return Response.json({ id }, { status: 201 });
  } catch {
    return Response.json({ error: "Could not save vendor commitment. Please try again." }, { status: 500 });
  }
}
