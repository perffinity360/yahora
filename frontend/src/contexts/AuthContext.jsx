import React, { createContext, useContext, useState, useEffect } from 'react';

// Create the Context
const AuthContext = createContext();

// Create a Provider Component
export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  // Check localStorage the moment the app starts or refreshes
  useEffect(() => {
    const token = localStorage.getItem('yahora_session');
    const userId = localStorage.getItem('yahora_user_id');
    
    if (token && userId) {
      setIsAuthenticated(true);
    }
    setLoading(false); // Finished checking
  }, []);

  // Function to call when logging in
  const login = (token, userId) => {
    localStorage.setItem('yahora_session', token);
    localStorage.setItem('yahora_user_id', userId);
    setIsAuthenticated(true);
  };

  // Function to call when manually logging out
  const logout = () => {
    localStorage.removeItem('yahora_session');
    localStorage.removeItem('yahora_user_id');
    localStorage.removeItem("yahora_demo_user");
    localStorage.removeItem("yahora_university_id");
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout, loading }}>
      {/* Do not render the app until we finish checking localStorage */}
      {!loading && children} 
    </AuthContext.Provider>
  );
};

// Custom hook to make it easy to use anywhere
export const useAuth = () => useContext(AuthContext);