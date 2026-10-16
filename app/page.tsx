import { requireChatGPTUser } from "./chatgpt-auth";
import Dashboard from "./dashboard";
import { env } from "cloudflare:workers";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireChatGPTUser("/");
  const adminId = (env as unknown as { PILOT_ADMIN_USER_ID?: string }).PILOT_ADMIN_USER_ID;
  return <Dashboard displayName={user.displayName} canReviewPilot={!!adminId && user.userId === adminId} />;
}
