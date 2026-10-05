import fs from "fs/promises";
import path from "path";
import { ObjectId } from "mongodb";
import { getRootDir, runGitLiteCommand } from "@/lib/gitlite";
import { getDatabase } from "@/lib/mongodb";

export interface RepositoryDocument {
  _id: ObjectId;
  ownerId: string;
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RepositorySummary {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

const repositoryIndexState = globalThis as typeof globalThis & {
  __gitliteRepositoriesIndex?: Promise<void>;
};

async function getRepositoriesCollection() {
  const database = await getDatabase();
  const collection = database.collection<RepositoryDocument>("repositories");

  if (!repositoryIndexState.__gitliteRepositoriesIndex) {
    const indexPromise = collection.createIndex(
      { ownerId: 1, slug: 1 },
      { unique: true, name: "repositories_owner_slug_unique" }
    ).then(() => undefined);
    repositoryIndexState.__gitliteRepositoriesIndex = indexPromise;
    void indexPromise.catch(() => {
      if (repositoryIndexState.__gitliteRepositoriesIndex === indexPromise) {
        repositoryIndexState.__gitliteRepositoriesIndex = undefined;
      }
    });
  }

  await repositoryIndexState.__gitliteRepositoriesIndex;
  return collection;
}

function toSummary(repository: RepositoryDocument): RepositorySummary {
  return {
    id: repository._id.toString(),
    name: repository.name,
    slug: repository.slug,
    createdAt: repository.createdAt.toISOString(),
  };
}

export function getRepositoryStoragePath(ownerId: string, repositoryId: string): string {
  if (!ObjectId.isValid(ownerId) || !ObjectId.isValid(repositoryId)) {
    throw new Error("Invalid repository identity.");
  }

  const root = path.resolve(
    process.env.GITLITE_DATA_DIR || path.join(getRootDir(), ".gitlite-data")
  );
  const storagePath = path.resolve(root, ownerId, repositoryId);
  if (!storagePath.startsWith(`${root}${path.sep}`)) {
    throw new Error("Repository storage path is outside the configured data directory.");
  }
  return storagePath;
}

export async function listOwnedRepositories(ownerId: string): Promise<RepositorySummary[]> {
  const repositories = await getRepositoriesCollection();
  const documents = await repositories.find({ ownerId }).sort({ createdAt: -1 }).toArray();
  return documents.map(toSummary);
}

export async function getOwnedRepository(
  ownerId: string,
  repositoryId: string
): Promise<RepositoryDocument | null> {
  if (!ObjectId.isValid(repositoryId)) return null;
  const repositories = await getRepositoriesCollection();
  return repositories.findOne({ _id: new ObjectId(repositoryId), ownerId });
}

export async function updateOwnedRepositoryTimestamp(ownerId: string, repositoryId: string): Promise<void> {
  if (!ObjectId.isValid(repositoryId)) return;
  const repositories = await getRepositoriesCollection();
  await repositories.updateOne(
    { _id: new ObjectId(repositoryId), ownerId },
    { $set: { updatedAt: new Date() } }
  );
}

export async function createOwnedRepository(
  ownerId: string,
  name: string
): Promise<RepositorySummary> {
  const slug = name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-|-$/g, "");
  const id = new ObjectId();
  const storagePath = getRepositoryStoragePath(ownerId, id.toString());
  await fs.mkdir(storagePath, { recursive: true });

  const initialization = await runGitLiteCommand(["init"], storagePath);
  if (!initialization.success) {
    await fs.rm(storagePath, { recursive: true, force: true });
    throw new Error(`GitLite could not initialize this repository: ${initialization.stderr}`);
  }

  const now = new Date();
  const repository: RepositoryDocument = {
    _id: id,
    ownerId,
    name,
    slug,
    createdAt: now,
    updatedAt: now,
  };

  try {
    const repositories = await getRepositoriesCollection();
    await repositories.insertOne(repository);
  } catch (error) {
    await fs.rm(storagePath, { recursive: true, force: true });
    throw error;
  }

  return toSummary(repository);
}
