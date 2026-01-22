import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, collection, addDoc, serverTimestamp, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions"; 

const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: import.meta.env.VITE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export services for use in your components
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app); 

// --- CONNECT EMULATORS (Local Development) ---
// if (window.location.hostname === "localhost") {
//   console.log("Using Local Emulators");
//   connectAuthEmulator(auth, "http://127.0.0.1:9099"); // Port 9099 is default for Auth
//   connectFirestoreEmulator(db, '127.0.0.1', 8080);    // Port 8080 is default for Firestore
//   connectFunctionsEmulator(functions, "127.0.0.1", 5001);
//   connectStorageEmulator(storage, "127.0.0.1", 9199); // If you added storage
// }

export const logAction = async (docId, action, details = "", performedBy = null) => {
  try {
    const userEmail = performedBy || (auth.currentUser ? auth.currentUser.email : "Unknown");
    // Creates a sub-collection called 'history' inside the specific document
    await addDoc(collection(db, "documents", docId, "history"), {
      action: action,        // e.g., "Document Uploaded"
      details: details,      // e.g., "User uploaded file.pdf"
      timestamp: serverTimestamp(),
      user: userEmail
    });
    console.log("Action Logged:", action);
  } catch (error) {
    console.error("Failed to log action:", error);
  }
};

export default app;