import { redirect } from "next/navigation";
import RepositoryList from "@/components/RepositoryList";
import { getAuthSession } from "@/lib/auth";

export default function DashboardPage() {
  const session = getAuthSession();
  if (!session) {
    redirect("/login");
  }

  return <RepositoryList userName={session.name} />;
}
