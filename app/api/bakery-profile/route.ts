import { eq } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getDb } from "../../../db";
import { bakeryProfiles } from "../../../db/schema";
import { emptyBakeryProfile, parseBakeryProfile } from "../../../lib/business-profile";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  try {
    const [row] = await getDb().select().from(bakeryProfiles).where(eq(bakeryProfiles.ownerId, user.userId));
    const { ownerId: _ownerId, updatedAt: _updatedAt, ...profile } = row ?? { ...emptyBakeryProfile, ownerId: user.userId, updatedAt: "" };
    return Response.json({ profile });
  } catch {
    return Response.json({ error: "Could not load your bakery profile." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  try {
    const profile = parseBakeryProfile(await request.json());
    if (!profile) return Response.json({ error: "Enter a bakery name and check your contact details or logo." }, { status: 400 });
    await getDb().insert(bakeryProfiles).values({ ...profile, ownerId: user.userId, updatedAt: new Date().toISOString() })
      .onConflictDoUpdate({ target: bakeryProfiles.ownerId, set: { ...profile, updatedAt: new Date().toISOString() } });
    return Response.json({ profile });
  } catch {
    return Response.json({ error: "Could not save your bakery profile." }, { status: 500 });
  }
}
