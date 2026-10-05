import { randomUUID } from "crypto";
import { ObjectId } from "mongodb";
import { getDatabase } from "@/lib/mongodb";
import { RepositorySyncConflict } from "@/lib/repository-sync-error";

export async function acquireRepositorySyncLocks(
  ownerId: string,
  repositoryIds: string[]
): Promise<() => Promise<void>> {
  const collection = (await getDatabase()).collection("repositories");
  const token = randomUUID();
  const lockedIds: ObjectId[] = [];
  const lockUntil = new Date(Date.now() + 30 * 60 * 1000);

  try {
    for (const repositoryId of Array.from(new Set(repositoryIds)).sort()) {
      if (!ObjectId.isValid(repositoryId)) {
        throw new Error("Repository not found.");
      }
      const id = new ObjectId(repositoryId);
      const result = await collection.updateOne(
        {
          _id: id,
          ownerId,
          $or: [
            { syncLockUntil: { $exists: false } },
            { syncLockUntil: { $lt: new Date() } },
          ],
        },
        { $set: { syncLockToken: token, syncLockUntil: lockUntil } }
      );
      if (result.matchedCount !== 1) {
        throw new RepositorySyncConflict("Repository is currently being synced. Please try again shortly.");
      }
      lockedIds.push(id);
    }
  } catch (error) {
    await Promise.all(lockedIds.map((id) =>
      collection.updateOne({ _id: id, ownerId, syncLockToken: token }, {
        $unset: { syncLockToken: "", syncLockUntil: "" },
      })
    ));
    throw error;
  }

  return async () => {
    await Promise.all(lockedIds.map((id) =>
      collection.updateOne({ _id: id, ownerId, syncLockToken: token }, {
        $unset: { syncLockToken: "", syncLockUntil: "" },
      })
    ));
  };
}
