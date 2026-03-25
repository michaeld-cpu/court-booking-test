import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const navigate = useNavigate();
  const { user, mobileNumber, logout } = useAuth();

  const handleLogout = () => {
    logout();
    onClose();
    navigate('/');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Profile</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Name</span>
              <span className="font-medium">{user?.name ?? '—'}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-gray-600">Mobile</span>
              <span className="font-medium">{mobileNumber ?? '—'}</span>
            </div>
          </div>
          <Button onClick={handleLogout} className="w-full" variant="outline">
            Logout
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
