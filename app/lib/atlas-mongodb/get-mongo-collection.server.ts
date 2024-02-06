import { Collection } from "mongodb";
import { mongoClient } from "./client.server";
import { mongoDbName } from "./config";

export default function getMongoCollection<T>(name: string): Collection {
  const dbName = mongoDbName;

  if (!dbName) {
    throw new Error("getMongoCollection - No database name provided");
  }

  const db = mongoClient.db(dbName);
  // @ts-ignore
  return db.collection<T>(name);
}
