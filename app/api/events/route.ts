import { eq, desc, inArray } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getDb } from "../../../db";
import { budgets, commitments, events, expenses, payments } from "../../../db/schema";
import { CATEGORIES, toPaise } from "../../../lib/finance";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  try {
    const db = getDb();
    const owned = await db.select().from(events).where(eq(events.ownerId, user.userId)).orderBy(desc(events.createdAt));
    if (!owned.length) return Response.json({ events: [] });
    const ids = owned.map((item) => item.id);
    const [plans, costs, vendorPlans, received] = await Promise.all([
      db.select().from(budgets).where(inArray(budgets.eventId, ids)),
      db.select().from(expenses).where(inArray(expenses.eventId, ids)).orderBy(desc(expenses.createdAt)),
      db.select().from(commitments).where(inArray(commitments.eventId, ids)).orderBy(commitments.dueOn),
      db.select().from(payments).where(inArray(payments.eventId, ids)).orderBy(desc(payments.receivedOn), desc(payments.createdAt)),
    ]);
    return Response.json({ events: owned.map(({ ownerId: _ownerId, ...item }) => ({
      ...item,
      budgets: plans.filter((row) => row.eventId === item.id).map(({ category, plannedPaise }) => ({ category, plannedPaise })),
      expenses: costs.filter((row) => row.eventId === item.id).map(({ id, commitmentId, category, description, amountPaise, spentOn }) => ({ id, commitmentId, category, description, amountPaise, spentOn })),
      commitments: vendorPlans.filter((row) => row.eventId === item.id).map(({ id, vendor, category, agreedPaise, dueOn }) => ({ id, vendor, category, agreedPaise, dueOn })),
      payments: received.filter((row) => row.eventId === item.id).map(({ id, amountPaise, receivedOn, note }) => ({ id, amountPaise, receivedOn, note })),
    })) });
  } catch {
    return Response.json({ error: "Could not load events. Please try again." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  try {
    const data = await request.json() as Record<string, unknown>;
    const name = typeof data.name === "string" ? data.name.trim() : "";
    const client = typeof data.client === "string" ? data.client.trim() : "";
    const eventDate = typeof data.eventDate === "string" ? data.eventDate : "";
    const quotePaise = toPaise(data.quote);
    const inputBudgets = data.budgets && typeof data.budgets === "object" ? data.budgets as Record<string, unknown> : {};
    const plans = CATEGORIES.map((category) => ({ category, plannedPaise: toPaise(inputBudgets[category]) }));
    if (!name || name.length > 100 || client.length > 100 || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate) || quotePaise === null || quotePaise === 0 || plans.some((row) => row.plannedPaise === null)) {
      return Response.json({ error: "Enter an event name, date, quote, and valid category budgets." }, { status: 400 });
    }
    const id = crypto.randomUUID();
    const db = getDb();
    await db.batch([
      db.insert(events).values({ id, ownerId: user.userId, name, client, eventDate, quotePaise, createdAt: new Date().toISOString() }),
      db.insert(budgets).values(plans.map((row) => ({ id: crypto.randomUUID(), eventId: id, category: row.category, plannedPaise: row.plannedPaise! }))),
    ]);
    return Response.json({ id }, { status: 201 });
  } catch {
    return Response.json({ error: "Could not create event. Please try again." }, { status: 500 });
  }
}
