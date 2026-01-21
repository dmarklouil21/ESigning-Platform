// src/context/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile,
  sendEmailVerification, 
  sendPasswordResetEmail 
} from 'firebase/auth';
import { doc, setDoc, onSnapshot } from 'firebase/firestore'; // <--- Added onSnapshot
import { auth, db } from '../firebase'; 

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null); // <--- New: Stores DB data (Pro status)
  const [loading, setLoading] = useState(true);

  // 1. Sign Up Function
  const signup = async (email, password, firstName, lastName) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const createdUser = userCredential.user;

    await updateProfile(createdUser, {
      displayName: `${firstName} ${lastName}`
    });

    await setDoc(doc(db, "users", createdUser.uid), {
      firstName: firstName,
      lastName: lastName,
      email: email,
      createdAt: new Date().toISOString(),
      uid: createdUser.uid,
      subscriptionStatus: 'free' // Default status
    });
    
    return createdUser;
  };

  // 2. Login Function
  const login = (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  // 3. Logout Function
  const logout = () => {
    return signOut(auth);
  };

  // 4. Send Verification Email
  const sendVerificationEmail = (currentUser) => {
    const targetUser = currentUser || auth.currentUser;
    if (targetUser) {
      return sendEmailVerification(targetUser);
    }
  };

  // 5. Reload User
  const reloadUser = async () => {
    if (auth.currentUser) {
      await auth.currentUser.reload();
      setUser({ ...auth.currentUser });
      return auth.currentUser;
    }
  };

  // 6. Monitor Auth State & Profile Data
  useEffect(() => {
    // A. Auth Listener
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      
      if (!currentUser) {
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // B. Database Listener (Runs only when user is logged in)
  useEffect(() => {
    let unsubscribeSnapshot = null;

    if (user) {
      const userRef = doc(db, "users", user.uid);
      
      // Listen for real-time changes to the user's document
      unsubscribeSnapshot = onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) {
          setUserProfile(docSnap.data());
        }
        setLoading(false);
      });
    }

    return () => {
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, [user]);

  // Derived Helper: Check if user is Pro
  const isPro = userProfile?.subscriptionStatus === 'active';

  const value = {
    user,
    userProfile, // Access to raw DB data
    isPro,       // Simple boolean for UI
    signup,
    login,
    logout,
    sendVerificationEmail,
    reloadUser
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};