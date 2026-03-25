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
}

export function Header({
  cartCount,
  onCartClick,
  onLoginClick,
  hasPendingBookings,
  hasConfirmedBookings,
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
  };

  return (
    <header
      className={`bg-white border-b border-slate-200 sticky top-0 z-[1100] ${isAuthenticated
        ? location.pathname === '/'
          ? 'block md:block'
          : 'hidden md:block'
        : 'block'
        }`}
    >
      <div className="mx-auto w-full max-w-[1300px] px-4 md:px-8 py-3">
        <nav className="flex items-center justify-between h-14">
          {/* Left side - Hamburger and Title */}
          <div className="flex items-center gap-6 md:gap-10 hover:cursor-pointer">

            {/* Title / Logo */}
            <Link
              to="/"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-3"
            >
              {/* Logo SVG Placeholder */}
              <div className="w-35 h-35 flex items-center justify-center text-slate-800">
                <Icons.logo />
              </div>
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
                    {to === '/bookings' && (hasPendingBookings || hasConfirmedBookings) && (
                      <span
                        className={`absolute -top-1 -left-1 size-2 rounded-full ring-2 ring-white ${hasPendingBookings ? 'bg-red-500' : 'bg-emerald-500'
                          }`}
                      />
                    )}
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
              className="hidden md:flex relative items-center justify-center h-10 w-10 rounded-full bg-slate-50 text-slate-700 hover:bg-slate-100 transition-colors"
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
              className="md:hidden text-slate-600 hover:text-slate-900 p-2.5 -mr-2 bg-slate-50 rounded-full transition-colors active:bg-slate-100"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? (
                <Icons.close className="size-6" />
              ) : (
                <Icons.menu className="size-6" />
              )}
            </button>
          </div>
        </nav>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-slate-100 mt-4 py-4">
            <div className="flex flex-col space-y-1">
              {navigationLinks.map(({ to, icon: Icon, label }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={(event) => {
                    handleNavClick(event, to);
                    handleLinkClick();
                  }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-semibold ${isActive(to)
                    ? 'text-slate-900 bg-slate-100/80'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                >
                  <span className="relative">
                    <Icon className="size-[20px]" strokeWidth={2.5} />
                    {to === '/bookings' && (hasPendingBookings || hasConfirmedBookings) && (
                      <span
                        className={`absolute -top-1 -left-1 size-2 rounded-full ring-2 ring-white ${hasPendingBookings ? 'bg-red-500' : 'bg-emerald-500'
                          }`}
                      />
                    )}
                  </span>
                  <span>{label}</span>
                </Link>
              ))}

              {/* Cart in Mobile Menu */}
              <button
                onClick={() => {
                  onCartClick();
                  handleLinkClick();
                }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 w-full text-left"
              >
                <div className="relative">
                  <Icons.cart className="size-[18px]" strokeWidth={2.5} />
                  {cartCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-[#C8F542] text-black font-extrabold rounded-full min-w-[16px] h-[16px] flex items-center justify-center text-[10px] px-0.5">
                      {cartCount}
                    </span>
                  )}
                </div>
                <span>Cart</span>
              </button>

              {/* Auth in Mobile Menu */}
              <div className="border-t border-slate-100 pt-3 mt-3 px-2">
                {isAuthenticated ? (
                  <>
                    <div className="px-3 py-3 text-sm text-slate-500 bg-slate-50 rounded-xl mb-2">
                      {user?.name && <div className="font-semibold text-slate-900 mb-1">{user.name}</div>}
                      <div>{mobileNumber}</div>
                    </div>
                    <button
                      onClick={() => {
                        handleLogout();
                        handleLinkClick();
                      }}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors font-semibold"
                    >
                      <Icons.logout className="size-[20px]" strokeWidth={2.5} />
                      <span>Logout</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      onLoginClick();
                      handleLinkClick();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors font-semibold"
                  >
                    <Icons.user className="size-[20px]" strokeWidth={2.5} />
                    <span>Login</span>
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
