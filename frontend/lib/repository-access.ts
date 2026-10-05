import { AuthSession } from "@/lib/auth";
import { getRepositoryStoragePath, getOwnedRepository } from "@/lib/repositories";

export async function authorizeRepository(session: AuthSession, repositoryId: string) {
  const repository = await getOwnedRepository(session.userId, repositoryId);
  if (!repository) return null;

  return {
    repository,
    root: getRepositoryStoragePath(session.userId, repository._id.toString()),
  };
}
