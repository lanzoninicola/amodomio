import { Collection, Document } from "mongodb";
import { mongoClient } from "./mongo-client.server";
import { mongoDbName } from "./config";

// https://www.mongodb.com/docs/drivers/node/current/fundamentals/typescript/
// https://mongodb.github.io/node-mongodb-native/6.3/classes/Collection.html

export default function createMongoCollection<T>(
  name: string
): Collection<Document> {
  if (!mongoDbName) {
    console.error("getMongoCollection - No database name provided");
  }

  const db = mongoClient.db(mongoDbName);

  // @ts-ignore
  return db.collection<T>(name);
}
