import { notFound, redirect } from "next/navigation";
import GitLiteDashboard from "@/components/GitLiteDashboard";
import { getAuthSession } from "@/lib/auth";
import { getOwnedRepository } from "@/lib/repositories";

export const runtime = "nodejs";

export default async function RepositoryDashboardPage({
  params,
}: {
  params: { repositoryId: string };
}) {
  const session = getAuthSession();
  if (!session) {
    redirect("/login");
  }

  const repository = await getOwnedRepository(session.userId, params.repositoryId);
  if (!repository) {
    notFound();
  }
  return (
    <GitLiteDashboard
      userName={session.name}
      repositoryId={repository._id.toString()}
      repositoryName={repository.name}
    />
  );
}
