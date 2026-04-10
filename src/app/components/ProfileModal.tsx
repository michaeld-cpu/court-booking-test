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
      <DialogContent className="max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Profile</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-500 font-medium">Name</span>
              <span className="font-semibold text-slate-800">{user?.name ?? '—'}</span>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-gray-500 font-medium">Mobile</span>
              <span className="font-semibold text-slate-800">{mobileNumber ?? '—'}</span>
            </div>
          </div>
          <Button onClick={handleLogout} className="w-full h-11 rounded-xl font-semibold" variant="outline">
            Logout
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
