import SettingsPanel from "@/components/SettingsPanel";
import { requireSession } from "@/lib/auth";

export default async function SettingsRoute() {
  await requireSession();
  return <SettingsPanel />;
}
