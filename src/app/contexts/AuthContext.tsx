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
  // Helper to get initial state from localStorage
  const getInitialAuth = () => {
    if (typeof window === 'undefined') return { isAuthenticated: false, mobileNumber: null, token: null, name: null, user: null };
    try {
      const savedAuth = localStorage.getItem('courtbook_auth');
      if (savedAuth) {
        const { mobileNumber, token, name, user, timestamp } = JSON.parse(savedAuth);
        const isValid = Date.now() - timestamp < 30 * 24 * 60 * 60 * 1000;
        if (isValid && token) {
          setAuthToken(token);
          return { isAuthenticated: true, mobileNumber, token, name: name ?? null, user: user ?? null };
        }
      }
    } catch (e) {
      console.error('Failed to parse auth state', e);
    }
    return { isAuthenticated: false, mobileNumber: null, token: null, name: null, user: null };
  };

  const initialAuth = getInitialAuth();
  const [isAuthenticated, setIsAuthenticated] = useState(initialAuth.isAuthenticated);
  const [mobileNumber, setMobileNumber] = useState<string | null>(initialAuth.mobileNumber);
  const [token, setToken] = useState<string | null>(initialAuth.token);
  const [name, setName] = useState<string | null>(initialAuth.name);
  const [user, setUser] = useState<{ id: number; name: string; email: string | null; role: string | null } | null>(initialAuth.user);

  // Still keep the useEffect but it will mostly be redundant now for initial load, 
  // but good for cross-tab sync or if we need to re-verify.
  useEffect(() => {
    const savedAuth = localStorage.getItem('courtbook_auth');
    if (savedAuth && !isAuthenticated) {
      const { mobileNumber, token, name, user, timestamp } = JSON.parse(savedAuth);
      const isValid = Date.now() - timestamp < 30 * 24 * 60 * 60 * 1000;
      if (isValid && token) {
        setIsAuthenticated(true);
        setMobileNumber(mobileNumber);
        setToken(token);
        setName(name ?? null);
        setUser(user ?? null);
        setAuthToken(token);
      }
    }
  }, [isAuthenticated]);

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
