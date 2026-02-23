const getFirebaseConfig = () => {
  // Firestore is legacy in this project. Keep disabled by default.
  const firestoreEnabled = process.env.ENABLE_FIRESTORE === "true";
  const projectId = process.env.project_id;

  if (!firestoreEnabled) {
    return {
      project_id: "",
    };
  }

  if (!projectId) {
    console.error(
      "ENABLE_FIRESTORE=true but project_id is missing. Firestore will stay disabled."
    );
  }

  return {
    // type: process.env.type,
    project_id: projectId || "",
    // private_key_id: process.env.private_key_id,
    // private_key: process.env.private_key,
    // client_email: process.env.client_email,
    // client_id: process.env.client_id,
    // auth_uri: process.env.auth_uri,
    // token_uri: process.env.token_uri,
    // auth_provider_x509_cert_url: process.env.auth_provider_x509_cert_url,
    // client_x509_cert_url: process.env.client_x509_cert_url,
    // universe_domain: process.env.universe_domain,
  };
};

export default getFirebaseConfig;
