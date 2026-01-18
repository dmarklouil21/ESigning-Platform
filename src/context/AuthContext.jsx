// src/context/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile,
  sendEmailVerification, // 1. Added import
  sendPasswordResetEmail // Optional: Handy to have
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore'; 
import { auth, db } from '../firebase'; 

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // 1. Sign Up Function
  const signup = async (email, password, firstName, lastName) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    await updateProfile(user, {
      displayName: `${firstName} ${lastName}`
    });

    await setDoc(doc(db, "users", user.uid), {
      firstName: firstName,
      lastName: lastName,
      email: email,
      createdAt: new Date().toISOString(),
      uid: user.uid
    });
    
    return user;
  };

  // 2. Login Function
  const login = (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  // 3. Logout Function
  const logout = () => {
    return signOut(auth);
  };

  // 4. Send Verification Email (New Helper)
  const sendVerificationEmail = (user) => {
    // If no user is passed, use the current context user
    const targetUser = user || auth.currentUser;
    if (targetUser) {
      return sendEmailVerification(targetUser);
    }
  };

  // 5. Reload User (New Helper)
  // Essential for checking if emailVerified status changed without re-logging in
  const reloadUser = async () => {
    if (auth.currentUser) {
      await auth.currentUser.reload();
      setUser({ ...auth.currentUser });
      return auth.currentUser;
    }
  };

  // 6. Monitor Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const value = {
    user,
    signup,
    login,
    logout,
    sendVerificationEmail, // Exported
    reloadUser             // Exported
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};