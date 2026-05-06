import type { Firestore } from "firebase/firestore";

export default class FirestoreClient {
  get connection() {
    if (!this._connection) {
      throw new Error(
        "Firestore is disabled (missing project_id). This code path is legacy and should use Prisma."
      );
    }

    return this._connection;
  }

  constructor(private _connection: Firestore | null) {}
}
