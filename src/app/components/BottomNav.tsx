import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutGrid, Calendar, Bookmark, ShoppingCart } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface BottomNavProps {
  cartCount: number;
  isCartOpen?: boolean;
  onCartClick: () => void;
  onLoginClick: () => void;
  onMenuClick?: () => void;
  hasPendingBookings?: boolean;
  hasConfirmedBookings?: boolean;
}

export function BottomNav({
  cartCount,
  isCartOpen,
  onCartClick,
  onLoginClick,
  onMenuClick,
  hasPendingBookings,
  hasConfirmedBookings,
}: BottomNavProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  const isActive = (path: string) => location.pathname === path;
  const getMenuColor = (path: string) => {
    if (isCartOpen) {
      return 'text-gray-500';
    }
    return isActive(path) ? 'text-gray-900' : 'text-gray-500';
  };

  const handleMenuAction = (action: () => void) => {
    onMenuClick?.();
    action();
  };

  return (
    <nav
      className="fixed md:hidden left-0 right-0 bottom-0 z-[1200] border-t border-gray-200 bg-white/95 backdrop-blur shadow-[0_-8px_24px_rgba(15,23,42,0.12)]"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="flex items-center justify-between px-2 py-3">
        <button
          type="button"
          onClick={() => handleMenuAction(() => navigate('/'))}
          className={`flex flex-1 flex-col items-center gap-1 text-[11px] ${getMenuColor('/')}`}
        >
          <LayoutGrid className="size-[1.35rem]" />
          Courts
        </button>
        <button
          type="button"
          onClick={() =>
            handleMenuAction(() => (isAuthenticated ? navigate('/bookings') : onLoginClick()))
          }
          className={`flex flex-1 flex-col items-center gap-1 text-[11px] ${getMenuColor('/bookings')}`}
        >
          <span className="relative">
            <Calendar className="size-[1.35rem]" />
            {(hasPendingBookings || hasConfirmedBookings) && (
              <span
                className={`absolute -top-1 -left-1 size-2 rounded-full ${
                  hasPendingBookings ? 'bg-red-500' : 'bg-emerald-500'
                }`}
              />
            )}
          </span>
          Bookings
        </button>
        <button
          type="button"
          onClick={() =>
            handleMenuAction(() => (isAuthenticated ? navigate('/bookmarks') : onLoginClick()))
          }
          className={`flex flex-1 flex-col items-center gap-1 text-[11px] ${getMenuColor('/bookmarks')}`}
        >
          <Bookmark className="size-[1.35rem]" />
          Saved
        </button>
        <button
          type="button"
          onClick={onCartClick}
          className={`relative flex flex-1 flex-col items-center gap-1 text-[11px] ${
            isCartOpen ? 'text-gray-900' : 'text-gray-500'
          }`}
        >
          <span className="relative inline-flex">
            <ShoppingCart className="size-[1.35rem]" />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-2 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-blue-500 px-1 text-[9px] font-semibold leading-none text-white">
                {cartCount}
              </span>
            )}
          </span>
          Cart
        </button>
      </div>
    </nav>
  );
}
