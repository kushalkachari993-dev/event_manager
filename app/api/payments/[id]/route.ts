import { and, eq, isNull } from "drizzle-orm";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { getDb } from "../../../../db";
import { events, payments } from "../../../../db/schema";
import { toPaise } from "../../../../lib/finance";

type Context = { params: Promise<{ id: string }> };

async function ownedPayment(id: string, ownerId: string) {
  const [row] = await getDb().select({ id: payments.id, eventId: payments.eventId })
    .from(payments).innerJoin(events, eq(payments.eventId, events.id))
    .where(and(eq(payments.id, id), eq(events.ownerId, ownerId), isNull(events.archivedAt))).limit(1);
  return row;
}

export async function PATCH(request: Request, { params }: Context) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  try {
    const { id } = await params;
    const owned = await ownedPayment(id, user.userId);
    if (!owned) return Response.json({ error: "Payment not found" }, { status: 404 });
    const data = await request.json() as Record<string, unknown>;
    const amountPaise = toPaise(data.amount);
    const receivedOn = typeof data.receivedOn === "string" ? data.receivedOn : "";
    const note = typeof data.note === "string" ? data.note.trim() : "";
    if (amountPaise === null || amountPaise === 0 || note.length > 160
      || !/^\d{4}-\d{2}-\d{2}$/.test(receivedOn)
      || Number.isNaN(Date.parse(`${receivedOn}T12:00:00Z`))) {
      return Response.json({ error: "Enter a valid amount and date. Notes can be up to 160 characters." }, { status: 400 });
    }

    await getDb().update(payments).set({ amountPaise, receivedOn, note })
      .where(and(eq(payments.id, id), eq(payments.eventId, owned.eventId)));
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Could not update payment. Please try again." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  try {
    const { id } = await params;
    const owned = await ownedPayment(id, user.userId);
    if (!owned) return Response.json({ error: "Payment not found" }, { status: 404 });
    await getDb().delete(payments).where(and(eq(payments.id, id), eq(payments.eventId, owned.eventId)));
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Could not remove payment. Please try again." }, { status: 500 });
  }
}
