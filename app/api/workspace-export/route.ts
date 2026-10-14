import { desc, eq, inArray } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getDb } from "../../../db";
import { bakeryProfiles, budgets, commitments, events, expenses, payments } from "../../../db/schema";
import { buildWorkspaceExport } from "../../../lib/workspace-export";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  try {
    const db = getDb();
    const ownedIds = db.select({ id: events.id }).from(events).where(eq(events.ownerId, user.userId));
    const [owned, plans, vendorPlans, costs, received, profiles] = await Promise.all([
      db.select().from(events).where(eq(events.ownerId, user.userId)).orderBy(desc(events.createdAt)),
      db.select().from(budgets).where(inArray(budgets.eventId, ownedIds)),
      db.select().from(commitments).where(inArray(commitments.eventId, ownedIds)),
      db.select().from(expenses).where(inArray(expenses.eventId, ownedIds)),
      db.select().from(payments).where(inArray(payments.eventId, ownedIds)),
      db.select().from(bakeryProfiles).where(eq(bakeryProfiles.ownerId, user.userId)),
    ]);
    const exportedAt = new Date().toISOString();
    const data = buildWorkspaceExport({ events: owned, budgets: plans, commitments: vendorPlans, expenses: costs, payments: received, bakeryProfile: profiles[0] ?? null }, exportedAt);
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="event-profit-watch-backup-${exportedAt.slice(0, 10)}.json"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json({ error: "Could not export your workspace. Please try again." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
