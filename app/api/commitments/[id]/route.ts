import { and, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { getDb } from "../../../../db";
import { commitments, events, expenses } from "../../../../db/schema";
import { isCategoryFor, toPaise } from "../../../../lib/finance";

type Context = { params: Promise<{ id: string }> };

async function ownedCommitment(id: string, ownerId: string) {
  const db = getDb();
  const [row] = await db.select({ id: commitments.id, kind: events.kind }).from(commitments)
    .innerJoin(events, eq(commitments.eventId, events.id))
    .where(and(eq(commitments.id, id), eq(events.ownerId, ownerId))).limit(1);
  return row;
}

export async function PATCH(request: Request, { params }: Context) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  try {
    const { id } = await params;
    const owned = await ownedCommitment(id, user.userId);
    if (!owned) return Response.json({ error: "Vendor commitment not found" }, { status: 404 });
    const data = await request.json() as Record<string, unknown>;
    const vendor = typeof data.vendor === "string" ? data.vendor.trim() : "";
    const category = data.category;
    const agreedPaise = toPaise(data.agreed);
    const dueOn = typeof data.dueOn === "string" ? data.dueOn : "";
    if (!vendor || vendor.length > 100 || !isCategoryFor(category, owned.kind === "bakery" ? "bakery" : "event") || agreedPaise === null || agreedPaise === 0
      || !/^\d{4}-\d{2}-\d{2}$/.test(dueOn) || Number.isNaN(Date.parse(`${dueOn}T12:00:00Z`))) {
      return Response.json({ error: "Enter a vendor, category, agreed cost, and due date." }, { status: 400 });
    }
    const db = getDb();
    await db.batch([
      db.update(commitments).set({ vendor, category, agreedPaise, dueOn }).where(eq(commitments.id, id)),
      db.update(expenses).set({ category }).where(eq(expenses.commitmentId, id)),
    ]);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Could not update vendor commitment. Please try again." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  try {
    const { id } = await params;
    if (!await ownedCommitment(id, user.userId)) return Response.json({ error: "Vendor commitment not found" }, { status: 404 });
    const db = getDb();
    await db.batch([
      db.update(expenses).set({ commitmentId: null }).where(eq(expenses.commitmentId, id)),
      db.delete(commitments).where(eq(commitments.id, id)),
    ]);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Could not remove vendor commitment. Please try again." }, { status: 500 });
  }
}
