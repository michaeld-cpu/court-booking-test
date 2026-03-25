import React, { ReactNode, useEffect } from 'react'
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { Lock, User } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  onLoginClick: () => void;
}

export function ProtectedRoute({ children, onLoginClick }: ProtectedRouteProps) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12">
        <div className="text-center max-w-md">
          <div className="mb-6 text-3xl font-bold tracking-wide text-gray-900" style={{ fontFamily: 'Alegreya Sans, sans-serif' }}>
            Korte
          </div>
          <div className="mb-6 flex justify-center">
            <div className="bg-gray-100 p-6 rounded-full">
              <Lock className="size-12 text-gray-400" />
            </div>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            Login Required
          </h2>
          <p className="text-gray-600 mb-6 mx-6">
            You need to be logged in to access this page. Please login to continue.
          </p>
          <Button
            onClick={onLoginClick}
            size="lg"
            className="gap-2"
          >
            <User className="size-5" />
            Login to Continue
          </Button>
          <div className="mt-4">
            <Link to="/" className="text-sm font-medium text-gray-500 hover:text-gray-700">
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
