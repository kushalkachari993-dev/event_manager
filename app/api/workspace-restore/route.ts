import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { MAX_BACKUP_BYTES, parseWorkspaceBackup, planWorkspaceRestore, type ExistingRestoreRows, type RestorePlan } from "../../../lib/workspace-restore";

const privateHeaders = { "Cache-Control": "private, no-store" };
const eventFields = [
  ["id", "id"], ["kind", "kind"], ["order_status", "orderStatus"], ["order_description", "orderDescription"],
  ["quantity", "quantity"], ["fulfillment", "fulfillment"], ["fulfillment_time", "fulfillmentTime"],
  ["deposit_required_paise", "depositRequiredPaise"], ["target_margin_pct", "targetMarginPct"],
  ["name", "name"], ["client", "client"], ["event_date", "eventDate"], ["quote_paise", "quotePaise"],
  ["created_at", "createdAt"], ["archived_at", "archivedAt"],
] as const;
const budgetFields = [["id", "id"], ["event_id", "eventId"], ["category", "category"], ["planned_paise", "plannedPaise"]] as const;
const commitmentFields = [["id", "id"], ["event_id", "eventId"], ["vendor", "vendor"], ["category", "category"], ["agreed_paise", "agreedPaise"], ["due_on", "dueOn"], ["created_at", "createdAt"]] as const;
const expenseFields = [["id", "id"], ["event_id", "eventId"], ["commitment_id", "commitmentId"], ["category", "category"], ["description", "description"], ["amount_paise", "amountPaise"], ["spent_on", "spentOn"], ["created_at", "createdAt"]] as const;
const paymentFields = [["id", "id"], ["event_id", "eventId"], ["amount_paise", "amountPaise"], ["received_on", "receivedOn"], ["note", "note"], ["created_at", "createdAt"]] as const;

async function readBackup(request: Request): Promise<string | null> {
  const declared = Number(request.headers.get("content-length"));
  if (declared > MAX_BACKUP_BYTES) return null;
  const reader = request.body?.getReader();
  if (!reader) return null;
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_BACKUP_BYTES) { await reader.cancel(); return null; }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

async function existingRows(db: D1Database, plan: NonNullable<ReturnType<typeof parseWorkspaceBackup>["backup"]>, ownerId: string): Promise<ExistingRestoreRows> {
  const ids = plan.records.map((row) => row.id);
  const childIds = {
    budgets: plan.records.flatMap((row) => row.budgets.map((item) => item.id)),
    commitments: plan.records.flatMap((row) => row.commitments.map((item) => item.id)),
    expenses: plan.records.flatMap((row) => row.expenses.map((item) => item.id)),
    payments: plan.records.flatMap((row) => row.payments.map((item) => item.id)),
  };
  async function matches<T>(table: string, rowIds: string[], columns: string): Promise<T[]> {
    if (!rowIds.length) return [];
    const result = await db.prepare(`SELECT ${columns} FROM ${table} WHERE id IN (SELECT value FROM json_each(?))`).bind(JSON.stringify(rowIds)).all<T>();
    return result.results;
  }
  const [foundEvents, foundBudgets, foundCommitments, foundExpenses, foundPayments, foundProfile] = await Promise.all([
    matches<{ id: string; owner_id: string; kind: string }>("events", ids, "id, owner_id, kind"),
    matches<{ id: string; event_id: string }>("budgets", childIds.budgets, "id, event_id"),
    matches<{ id: string; event_id: string }>("vendor_commitments", childIds.commitments, "id, event_id"),
    matches<{ id: string; event_id: string }>("expenses", childIds.expenses, "id, event_id"),
    matches<{ id: string; event_id: string }>("payments", childIds.payments, "id, event_id"),
    db.prepare("SELECT 1 AS present FROM bakery_profiles WHERE owner_id = ?").bind(ownerId).first<{ present: number }>(),
  ]);
  return {
    events: new Map(foundEvents.map((row) => [row.id, { ownerId: row.owner_id, kind: row.kind }])),
    budgets: new Map(foundBudgets.map((row) => [row.id, row.event_id])),
    commitments: new Map(foundCommitments.map((row) => [row.id, row.event_id])),
    expenses: new Map(foundExpenses.map((row) => [row.id, row.event_id])),
    payments: new Map(foundPayments.map((row) => [row.id, row.event_id])),
    hasProfile: !!foundProfile,
  };
}

function chunks(rows: unknown[]): string[] {
  const encoded = new TextEncoder();
  const result: string[] = [];
  let parts: string[] = [];
  let size = 2;
  for (const row of rows) {
    const part = JSON.stringify(row);
    const bytes = encoded.encode(part).byteLength + 1;
    if (parts.length && size + bytes > 700_000) {
      result.push(`[${parts.join(",")}]`);
      parts = [];
      size = 2;
    }
    parts.push(part);
    size += bytes;
  }
  if (parts.length) result.push(`[${parts.join(",")}]`);
  return result;
}

function insertStatements(db: D1Database, table: string, fields: readonly (readonly [string, string])[], rows: unknown[], ownerId?: string): D1PreparedStatement[] {
  if (!rows.length) return [];
  const columns = [...(ownerId ? ["owner_id"] : []), ...fields.map(([column]) => column)];
  const values = [...(ownerId ? ["?"] : []), ...fields.map(([, property]) => `json_extract(j.value, '$.${property}')`)];
  const query = `INSERT INTO ${table} (${columns.join(", ")}) SELECT ${values.join(", ")} FROM json_each(?) AS j WHERE NOT EXISTS (SELECT 1 FROM ${table} AS present WHERE present.id = json_extract(j.value, '$.id'))`;
  return chunks(rows).map((part) => ownerId ? db.prepare(query).bind(ownerId, part) : db.prepare(query).bind(part));
}

async function previewToken(text: string, summary: RestorePlan["summary"]): Promise<string> {
  const input = new TextEncoder().encode(`${text}\n${JSON.stringify(summary)}`);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401, headers: privateHeaders });
  const mode = new URL(request.url).searchParams.get("mode");
  if (mode !== "preview" && mode !== "import") return Response.json({ error: "Choose preview or import." }, { status: 400, headers: privateHeaders });
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return Response.json({ error: "Choose a JSON backup file." }, { status: 415, headers: privateHeaders });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "Invalid origin." }, { status: 403, headers: privateHeaders });
  const text = await readBackup(request);
  if (text === null) return Response.json({ error: "Backup is empty or larger than 5 MB." }, { status: 413, headers: privateHeaders });
  let json: unknown;
  try { json = JSON.parse(text); } catch { return Response.json({ error: "This file does not contain valid JSON." }, { status: 400, headers: privateHeaders }); }
  const parsed = parseWorkspaceBackup(json);
  if (!parsed.backup) return Response.json({ error: parsed.error }, { status: 400, headers: privateHeaders });
  try {
    const db = env.DB;
    if (!db) throw new Error("Database unavailable");
    const existing = await existingRows(db, parsed.backup, user.userId);
    let plan: RestorePlan;
    try { plan = planWorkspaceRestore(parsed.backup, user.userId, existing); }
    catch (cause) { return Response.json({ error: cause instanceof Error ? cause.message : "Backup conflicts with this workspace." }, { status: 409, headers: privateHeaders }); }
    const token = await previewToken(text, plan.summary);
    if (mode === "preview") return Response.json({ summary: plan.summary, previewToken: token }, { headers: privateHeaders });
    if (request.headers.get("x-restore-preview") !== token) return Response.json({ error: "The workspace or backup changed since preview. Preview the file again." }, { status: 409, headers: privateHeaders });

    const eventRows = plan.records.map(({ budgets: _budgets, commitments: _commitments, expenses: _expenses, payments: _payments, ...row }) => row);
    const statements: D1PreparedStatement[] = [
      ...insertStatements(db, "events", eventFields, eventRows, user.userId),
      ...insertStatements(db, "budgets", budgetFields, plan.budgets),
      ...insertStatements(db, "vendor_commitments", commitmentFields, plan.commitments),
      ...insertStatements(db, "expenses", expenseFields, plan.expenses),
      ...insertStatements(db, "payments", paymentFields, plan.payments),
    ];
    if (plan.profile) {
      const profile = plan.profile;
      statements.push(db.prepare("INSERT INTO bakery_profiles (owner_id, business_name, phone, email, instagram, logo_data_url, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(owner_id) DO NOTHING")
        .bind(user.userId, profile.businessName, profile.phone, profile.email, profile.instagram, profile.logoDataUrl, profile.updatedAt));
    }
    if (statements.length > 40) return Response.json({ error: "This backup is too large to restore in one operation." }, { status: 413, headers: privateHeaders });
    if (statements.length) await db.batch(statements);
    return Response.json({ summary: plan.summary }, { headers: privateHeaders });
  } catch {
    return Response.json({ error: "Could not restore the backup. No partial import was kept; please try again." }, { status: 500, headers: privateHeaders });
  }
}
