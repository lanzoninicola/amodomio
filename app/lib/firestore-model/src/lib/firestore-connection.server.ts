import { initializeApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import getFirebaseConfig from "../config/get-firebase-config.server";

let firebaseConfig = getFirebaseConfig();
const projectId = firebaseConfig.project_id;
let connection: Firestore | null = null;

if (projectId) {
  // Optional name of the app to initialize
  const projectName = projectId;
  const firebaseApp = initializeApp({ projectId }, projectName);
  connection = getFirestore(firebaseApp);
}

export default connection;
