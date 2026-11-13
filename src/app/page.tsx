import Console from "@/components/Console";
import { requireSession } from "@/lib/auth";

export default async function HomePage() {
  await requireSession();
  return <Console />;
}
