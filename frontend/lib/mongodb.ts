import { Collection, MongoClient } from "mongodb";

export interface UserDocument {
  email: string;
  name: string;
  passwordHash: string;
  createdAt: Date;
}

interface MongoCache {
  clientPromise?: Promise<MongoClient>;
  usersCollectionPromise?: Promise<Collection<UserDocument>>;
}

const mongoCache = globalThis as typeof globalThis & { __gitliteMongo?: MongoCache };
const cache = (mongoCache.__gitliteMongo ??= {});

function getClient(): Promise<MongoClient> {
  if (!cache.clientPromise) {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error("MONGODB_URI is not configured.");
    }

    const clientPromise = new MongoClient(uri).connect();
    cache.clientPromise = clientPromise;
    void clientPromise.catch(() => {
      if (cache.clientPromise === clientPromise) {
        cache.clientPromise = undefined;
      }
    });
  }

  return cache.clientPromise;
}

export function getUsersCollection(): Promise<Collection<UserDocument>> {
  if (!cache.usersCollectionPromise) {
    const collectionPromise = getClient().then(async (client) => {
      const database = client.db(process.env.MONGODB_DB || "gitlite");
      const users = database.collection<UserDocument>("users");
      await users.createIndex({ email: 1 }, { unique: true, name: "users_email_unique" });
      return users;
    });

    cache.usersCollectionPromise = collectionPromise;
    void collectionPromise.catch(() => {
      if (cache.usersCollectionPromise === collectionPromise) {
        cache.usersCollectionPromise = undefined;
      }
    });
  }

  return cache.usersCollectionPromise;
}

export async function getDatabase() {
  const client = await getClient();
  return client.db(process.env.MONGODB_DB || "gitlite");
}
