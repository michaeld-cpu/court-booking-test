import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Icons } from './ui/icons';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './ui/popover';
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from '@/app/lib/toast';

interface HeaderProps {
  cartCount: number;
  onCartClick: () => void;
  onLoginClick: () => void;
  hasPendingBookings?: boolean;
  hasConfirmedBookings?: boolean;
  onCloseCart?: () => void;
}

export function Header({
  cartCount,
  onCartClick,
  onLoginClick,
  hasPendingBookings,
  hasConfirmedBookings,
  onCloseCart,
}: HeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isAuthenticated, mobileNumber, user, logout } = useAuth();

  const isActive = (path: string) => location.pathname === path;
  const isProtectedPath = (path: string) => path === '/bookings' || path === '/bookmarks';

  const handleNavClick = (event: React.MouseEvent, path: string) => {
    if (!isAuthenticated && isProtectedPath(path)) {
      event.preventDefault();
      onLoginClick();
    }
  };

  const handleLogout = () => {
    logout();
    toast.success('Logged out', {
      description: 'You have been signed out successfully.',
    });
    navigate('/');
  };

  const navigationLinks = [
    { to: '/', icon: Icons.court, label: 'Courts' },
    { to: '/bookings', icon: Icons.booking, label: 'Bookings' },
    { to: '/bookmarks', icon: Icons.save, label: 'Saved' },
  ];

  const handleLinkClick = () => {
    setIsMobileMenuOpen(false);
    onCloseCart?.();
  };

  return (
    <header
      className="bg-white fixed top-0 left-0 right-0 z-50 block w-full"
    >
      <div className="mx-auto w-full max-w-[1300px] px-4 md:px-8 py-3">
        <nav className="flex items-center justify-between h-14">
          {/* Left side - Hamburger and Title */}
          <div className="flex items-center gap-6 md:gap-10 hover:cursor-pointer">

            {/* Title / Logo */}
            <Link
              to="/"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center"
            >
              <Icons.logo className="h-10 md:h-10 w-auto text-slate-900" />
            </Link>

            {/* Desktop Navigation links */}
            <div className="hidden md:flex items-center gap-1">
              {navigationLinks.map(({ to, icon: Icon, label }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={(event) => handleNavClick(event, to)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-full transition-colors font-medium text-sm 
                    ${isActive(to)
                      ? 'text-neutral-950'
                      : 'text-gray-400 hover:text-gray-950'
                    }`}
                >
                  <span className="relative">
                    <Icon className="size-[18px]" strokeWidth={2.5} />
                  </span>
                  <span>{label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Right side - Auth & Cart buttons */}
          <div className="flex items-center gap-2 md:gap-4">
            {/* Cart button */}
            <button
              onClick={isAuthenticated ? onCartClick : onLoginClick}
              className="hidden md:flex relative items-center justify-center h-10 w-10 rounded-full bg-gray-100/80 text-slate-700 hover:bg-gray-100 transition-colors"
              aria-label="Cart"
            >
              <Icons.cart className="size-[18px] text-slate-800" strokeWidth={2.5} />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#C8F542] text-black font-extrabold rounded-full min-w-[20px] h-[20px] flex items-center justify-center text-[11px] px-1">
                  {cartCount}
                </span>
              )}
            </button>

            {/* Profile Dropdown */}
            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="hidden md:flex items-center justify-center h-10 w-10 rounded-full bg-black text-white hover:bg-slate-800 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
                    aria-label="Profile"
                  >
                    <Icons.user className="size-[18px]" strokeWidth={2.5} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-white border-slate-200 rounded-xl shadow-lg mt-2">
                  <DropdownMenuLabel className="text-slate-900 font-bold px-4 pt-3 pb-2">My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-slate-100 mx-2" />
                  <div className="px-4 py-3 text-sm text-slate-500">
                    {user?.name && <div className="font-semibold text-slate-900 mb-1">{user.name}</div>}
                    <div>{mobileNumber}</div>
                  </div>
                  <DropdownMenuSeparator className="bg-slate-100 mx-2" />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 cursor-pointer rounded-lg mx-2 mb-2 px-3 focus:bg-red-50 focus:text-red-700"
                  >
                    <Icons.logout className="mr-2 size-4" />
                    <span className="font-medium">Logout</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <button
                onClick={onLoginClick}
                className="hidden md:flex items-center justify-center h-10 w-10 rounded-full bg-black text-white hover:bg-slate-800 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
                aria-label="Login"
              >
                <Icons.user className="size-[18px]" strokeWidth={2.5} />
              </button>
            )}

            {/* Hamburger Menu Button - Mobile Only */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden flex items-center justify-center size-10 rounded-full bg-white transition-all active:scale-95 border border-slate-100/50"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? (
                <Icons.close className="size-5 text-slate-900" />
              ) : (
                <Icons.menu className="size-5 text-slate-900" />
              )}
            </button>
          </div>
        </nav>

        {/* Mobile Menu Dropdown */}
        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-[68px] right-4 w-[220px] bg-white rounded-[1rem] shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-100/50 z-[1200] overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right">
            <div className="flex flex-col">
              {/* Profile Section (Visible if logged in) */}
              {isAuthenticated && (
                <div className="p-4.5 flex items-center gap-2.5 border-b border-slate-50">
                  <div className="size-9 rounded-full bg-gray-900 text-white flex items-center justify-center font-semibold text-sm shrink-0">
                    {user?.name?.charAt(0) || mobileNumber?.charAt(0) || 'M'}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 truncate leading-tight text-[13px]">
                      {user?.name || 'User'}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate mt-0.5">
                      @{user?.name?.toLowerCase().replace(/\s+/g, '') || 'user'}
                    </div>
                  </div>
                </div>
              )}

              <div className="p-1 px-1.5 py-2 flex flex-col gap-1.5">
                <Link
                  to="/"
                  onClick={handleLinkClick}
                  className="flex items-center gap-4 px-3.5 py-2.5 rounded-xl text-slate-900 hover:bg-slate-50 transition-colors"
                >
                  <Icons.court className="size-[18px] text-slate-900" strokeWidth={1.5} />
                  <span className="font-semibold text-[13px]">Courts</span>
                </Link>

                <Link
                  to="/bookings"
                  onClick={(e) => {
                    handleNavClick(e, '/bookings');
                    handleLinkClick();
                  }}
                  className="flex items-center gap-4 px-3.5 py-2.5 rounded-xl text-slate-900 hover:bg-slate-50 transition-colors"
                >
                  <div className="relative">
                    <Icons.booking className="size-[18px] text-slate-900" strokeWidth={1.5} />
                  </div>
                  <span className="font-semibold text-[13px]">My Bookings</span>
                </Link>

                <Link
                  to="/bookmarks"
                  onClick={(e) => {
                    handleNavClick(e, '/bookmarks');
                    handleLinkClick();
                  }}
                  className="flex items-center gap-4 px-3.5 py-2.5 rounded-xl text-slate-900 hover:bg-slate-50 transition-colors"
                >
                  <Icons.save className="size-[18px] text-slate-900" strokeWidth={1.5} />
                  <span className="font-semibold text-[13px]">Saved</span>
                </Link>

                <button
                  onClick={() => {
                    handleLinkClick();
                    if (isAuthenticated) {
                      onCartClick();
                    } else {
                      onLoginClick();
                    }
                  }}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-slate-900 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <Icons.cart className="size-[18px] text-slate-900" strokeWidth={1.5} />
                    <span className="font-semibold text-[13px]">Cart</span>
                  </div>
                  {cartCount > 0 && (
                    <span className="bg-[#C8F542] text-black font-extrabold rounded-full min-w-[20px] h-[20px] flex items-center justify-center text-[11px] px-1">
                      {cartCount}
                    </span>
                  )}
                </button>
              </div>

              {/* Action Section */}
              <div className="border-t border-slate-100 p-1 px-1.5 py-2 bg-slate-50/30 flex flex-col gap-0.5">
                {isAuthenticated ? (
                  <button
                    onClick={() => {
                      handleLogout();
                      handleLinkClick();
                    }}
                    className="w-full flex items-center gap-4 px-3.5 py-2.5 rounded-xl text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Icons.logout className="size-[18px] rotate-180" strokeWidth={1.5} />
                    <span className="font-semibold text-[13px]">Sign Out</span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      onLoginClick();
                      handleLinkClick();
                    }}
                    className="w-full flex items-center gap-4 px-3.5 py-2.5 rounded-xl text-slate-900 hover:bg-slate-50 transition-colors"
                  >
                    <Icons.user className="size-[18px] text-slate-900" strokeWidth={1.5} />
                    <span className="font-semibold text-[13px]">Login</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
