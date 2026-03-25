import React from 'react'
import { Link } from 'react-router-dom'
import { Icons } from './ui/icons'

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-[#0A1E2D] py-6 text-white mt-auto">
      <div className="mx-auto w-full max-w-[1300px] px-6 md:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-col md:flex-row items-center gap-6 md:gap-12">
            {/* Logo */}
            <Link to="/" className="text-white opacity-40 transition-opacity">
              <Icons.logo className="h-9 w-auto" />
            </Link>

            {/* Links */}
            <nav className="flex items-center gap-6 md:gap-8 text-[13px] font-medium text-gray-500">
              <Link
                to="/terms"
                className="hover:text-white transition-colors"
              >
                Terms of Service
              </Link>
              <Link
                to="/privacy"
                className="hover:text-white transition-colors"
              >
                Privacy Policy
              </Link>
              <Link
                to="/contact-us"
                className="hover:text-white transition-colorse"
              >
                Contact Us
              </Link>
            </nav>
          </div>

          {/* Copyright */}
          <div className="text-[13px] text-gray-500 font-medium">
            © {currentYear} Korte. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  )
}
