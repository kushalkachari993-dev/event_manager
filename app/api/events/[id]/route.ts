import { and, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { getDb } from "../../../../db";
import { budgets, events } from "../../../../db/schema";
import { CATEGORIES, toPaise } from "../../../../lib/finance";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  try {
    const { id } = await params;
    const db = getDb();
    const [owned] = await db.select({ id: events.id }).from(events)
      .where(and(eq(events.id, id), eq(events.ownerId, user.userId))).limit(1);
    if (!owned) return Response.json({ error: "Event not found" }, { status: 404 });

    const data = await request.json() as Record<string, unknown>;
    if (data.action === "archive" || data.action === "restore") {
      await db.update(events).set({ archivedAt: data.action === "archive" ? new Date().toISOString() : null })
        .where(and(eq(events.id, id), eq(events.ownerId, user.userId)));
      return Response.json({ ok: true });
    }

    const name = typeof data.name === "string" ? data.name.trim() : "";
    const client = typeof data.client === "string" ? data.client.trim() : "";
    const eventDate = typeof data.eventDate === "string" ? data.eventDate : "";
    const quotePaise = toPaise(data.quote);
    const inputBudgets = data.budgets && typeof data.budgets === "object" && !Array.isArray(data.budgets)
      ? data.budgets as Record<string, unknown> : {};
    const plans = CATEGORIES.map((category) => ({ category, plannedPaise: toPaise(inputBudgets[category]) }));
    if (!name || name.length > 100 || client.length > 100 || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)
      || Number.isNaN(Date.parse(`${eventDate}T12:00:00Z`)) || quotePaise === null || quotePaise === 0
      || plans.some((row) => row.plannedPaise === null)) {
      return Response.json({ error: "Enter an event name, date, quote, and valid category budgets." }, { status: 400 });
    }
    await db.batch([
      db.update(events).set({ name, client, eventDate, quotePaise }).where(and(eq(events.id, id), eq(events.ownerId, user.userId))),
      ...plans.map((row) => db.update(budgets).set({ plannedPaise: row.plannedPaise! })
        .where(and(eq(budgets.eventId, id), eq(budgets.category, row.category)))),
    ]);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Could not update event. Please try again." }, { status: 500 });
  }
}
