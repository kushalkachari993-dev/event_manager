import { requireChatGPTUser } from "./chatgpt-auth";
import Dashboard from "./dashboard";

export default async function Home() {
  const user = await requireChatGPTUser("/");
  return <Dashboard displayName={user.displayName} />;
}
