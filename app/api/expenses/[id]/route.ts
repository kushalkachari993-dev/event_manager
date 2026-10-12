import { and, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { getDb } from "../../../../db";
import { commitments, events, expenses } from "../../../../db/schema";
import { isCategory, toPaise } from "../../../../lib/finance";

type Context = { params: Promise<{ id: string }> };

async function ownedExpense(id: string, ownerId: string) {
  const db = getDb();
  const [row] = await db.select({ id: expenses.id, eventId: expenses.eventId, commitmentId: expenses.commitmentId })
    .from(expenses).innerJoin(events, eq(expenses.eventId, events.id))
    .where(and(eq(expenses.id, id), eq(events.ownerId, ownerId))).limit(1);
  return row;
}

export async function PATCH(request: Request, { params }: Context) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  try {
    const { id } = await params;
    const owned = await ownedExpense(id, user.userId);
    if (!owned) return Response.json({ error: "Expense not found" }, { status: 404 });
    const data = await request.json() as Record<string, unknown>;
    const description = typeof data.description === "string" ? data.description.trim() : "";
    const [commitment] = owned.commitmentId ? await getDb().select({ category: commitments.category }).from(commitments)
      .where(eq(commitments.id, owned.commitmentId)).limit(1) : [];
    const category = commitment?.category ?? data.category;
    const amountPaise = toPaise(data.amount);
    const spentOn = typeof data.spentOn === "string" ? data.spentOn : "";
    if (!description || description.length > 160 || !isCategory(category) || amountPaise === null || amountPaise === 0
      || !/^\d{4}-\d{2}-\d{2}$/.test(spentOn) || Number.isNaN(Date.parse(`${spentOn}T12:00:00Z`))) {
      return Response.json({ error: "Enter a description, category, amount, and date." }, { status: 400 });
    }
    await getDb().update(expenses).set({ description, category, amountPaise, spentOn }).where(eq(expenses.id, id));
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Could not update expense. Please try again." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  try {
    const { id } = await params;
    const owned = await ownedExpense(id, user.userId);
    if (!owned) return Response.json({ error: "Expense not found" }, { status: 404 });
    await getDb().delete(expenses).where(and(eq(expenses.id, id), eq(expenses.eventId, owned.eventId)));
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Could not remove expense. Please try again." }, { status: 500 });
  }
}
