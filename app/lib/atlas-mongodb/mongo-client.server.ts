import { mongoDbName, mongoUri } from "./config.server";

const { MongoClient, ServerApiVersion } = require("mongodb");
const uri = mongoUri;

if (!uri) {
  throw new Error("ATLAS MONGODB URI must be set");
}

/**
 * NOTE:
 *
 * I don't whay, but with the default user MongoDB returns the error "MongoServerError: bad auth : authentication failed".
 *
 * I follow the instruction https://stackoverflow.com/questions/60020381/mongodb-atlas-bad-auth-authentication-failed-code-8000
 * adding a new user and it start to work
 */

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
export const mongoClient = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
/**
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await mongoClient.connect();

    const dbName = mongoDbName;

    if (!dbName) {
      throw new Error("ATLAS_MONGO_DBNAME must be set");
    }

    // Send a ping to confirm a successful connection
    await mongoClient.db(dbName).command({ ping: 30 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    await mongoClient.close();
  }
}
run().catch(console.dir);
 */
