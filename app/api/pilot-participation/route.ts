import { eq } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getDb } from "../../../db";
import { pilotParticipants } from "../../../db/schema";

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  try {
    const [participant] = await getDb().select({ joinedAt: pilotParticipants.joinedAt })
      .from(pilotParticipants).where(eq(pilotParticipants.ownerId, user.userId)).limit(1);
    return Response.json({ joinedAt: participant?.joinedAt ?? null });
  } catch {
    return Response.json({ error: "Could not load pilot status." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  if (!sameOrigin(request)) return Response.json({ error: "Invalid origin." }, { status: 403 });
  try {
    const db = getDb();
    await db.insert(pilotParticipants).values({
      ownerId: user.userId, email: user.email, joinedAt: new Date().toISOString(),
    }).onConflictDoUpdate({ target: pilotParticipants.ownerId, set: { email: user.email } });
    const [participant] = await db.select({ joinedAt: pilotParticipants.joinedAt })
      .from(pilotParticipants).where(eq(pilotParticipants.ownerId, user.userId)).limit(1);
    return Response.json({ joinedAt: participant.joinedAt });
  } catch {
    return Response.json({ error: "Could not join the pilot. Please try again." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  if (!sameOrigin(request)) return Response.json({ error: "Invalid origin." }, { status: 403 });
  try {
    await getDb().delete(pilotParticipants).where(eq(pilotParticipants.ownerId, user.userId));
    return Response.json({ joinedAt: null });
  } catch {
    return Response.json({ error: "Could not leave the pilot. Please try again." }, { status: 500 });
  }
}
