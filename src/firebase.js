// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { getStorage } from "firebase/storage";

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

export const logAction = async (docId, action, details = "") => {
  try {
    // Creates a sub-collection called 'history' inside the specific document
    await addDoc(collection(db, "documents", docId, "history"), {
      action: action,        // e.g., "Document Uploaded"
      details: details,      // e.g., "User uploaded file.pdf"
      timestamp: serverTimestamp(),
      user: auth.currentUser ? auth.currentUser.email : "Unknown"
    });
    console.log("Action Logged:", action);
  } catch (error) {
    console.error("Failed to log action:", error);
  }
};

export default app;