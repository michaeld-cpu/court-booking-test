import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { setAuthToken } from '../lib/api';

interface AuthContextType {
  isAuthenticated: boolean;
  mobileNumber: string | null;
  token: string | null;
  name: string | null;
  user: { id: number; name: string; email: string | null; role: string | null } | null;
  login: (auth: {
    mobileNumber: string;
    token: string;
    name?: string | null;
    user?: { id: number; name: string; email: string | null; role: string | null } | null;
  }) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [mobileNumber, setMobileNumber] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [user, setUser] = useState<{ id: number; name: string; email: string | null; role: string | null } | null>(null);

  // Load auth state from localStorage on mount
  useEffect(() => {
    const savedAuth = localStorage.getItem('courtbook_auth');
    if (savedAuth) {
      const { mobileNumber, token, name, user, timestamp } = JSON.parse(savedAuth);
      // Keep user logged in for 30 days
      const isValid = Date.now() - timestamp < 30 * 24 * 60 * 60 * 1000;
      if (isValid && token) {
        setIsAuthenticated(true);
        setMobileNumber(mobileNumber);
        setToken(token);
        setName(name ?? null);
        setUser(user ?? null);
        setAuthToken(token);
      } else {
        localStorage.removeItem('courtbook_auth');
        setAuthToken(null);
      }
    }
  }, []);

  const login = (auth: {
    mobileNumber: string;
    token: string;
    name?: string | null;
    user?: { id: number; name: string; email: string | null; role: string | null } | null;
  }) => {
    setIsAuthenticated(true);
    setMobileNumber(auth.mobileNumber);
    setToken(auth.token);
    setName(auth.name ?? null);
    setUser(auth.user ?? null);
    setAuthToken(auth.token);
    localStorage.setItem('courtbook_auth', JSON.stringify({
      mobileNumber: auth.mobileNumber,
      token: auth.token,
      name: auth.name ?? null,
      user: auth.user ?? null,
      timestamp: Date.now(),
    }));
  };

  const logout = () => {
    setIsAuthenticated(false);
    setMobileNumber(null);
    setToken(null);
    setName(null);
    setUser(null);
    localStorage.removeItem('courtbook_auth');
    setAuthToken(null);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('courtbook:logout'));
    }
  };

  useEffect(() => {
    const handleUnauthorized = () => {
      logout();
    };

    window.addEventListener('courtbook:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('courtbook:unauthorized', handleUnauthorized);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, mobileNumber, token, name, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
