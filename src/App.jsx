import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext'; // Import Context

import LandingPage from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Editor from './pages/Editor'; 
import RecipientSign from './pages/RecipientSign';
import Pricing from './pages/Pricing';
import Profile from './pages/Profile';

// Protected Route Component
// If user is NOT logged in, kick them back to Login page
const PrivateRoute = ({ children }) => {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <AuthProvider> {/* Wrap everything here */}
      <Router>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          
          {/* Protect the Dashboard */}
          <Route 
            path="/dashboard" 
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            } 
          /> 

          <Route 
            path="/profile" 
            element={
              <PrivateRoute>
                <Profile />
              </PrivateRoute>
            } 
          />

          {/* Editor Route */}
          <Route 
            path="/editor/:id" 
            element={
              <PrivateRoute>
                <Editor />
              </PrivateRoute>
            } 
          />

          <Route path="/sign/:id" element={<RecipientSign />} />

          <Route 
            path="/pricing" 
            element={
              <PrivateRoute>
                <Pricing />
              </PrivateRoute>
            } 
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;