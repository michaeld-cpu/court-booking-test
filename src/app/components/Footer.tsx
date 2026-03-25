import React from 'react'
import { Link } from 'react-router-dom'

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-gray-50 border-t border-gray-200 pt-7 pb-8 mt-auto text-gray-800 min-[1300px]:border-transparent min-[1300px]:pt-1 min-[1300px]:pb-6">
      <div className="container mx-auto px-4 md:px-8">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row justify-between items-center sm:items-start lg:items-center gap-4">
            {/* Links */}
            <div className="flex flex-col lg:flex-row items-center sm:items-start lg:items-center gap-2 lg:gap-4 text-sm text-gray-600 text-center sm:text-left -mb-2 sm:mb-0">
              <div className="flex items-center gap-4 justify-start">
                <Link
                  to="/terms"
                  className="text-sm hover:text-gray-900 transition-colors"
                >
                  <span className="md:hidden">Terms</span>
                  <span className="hidden md:inline">Terms of Service</span>
                </Link>
                <span className="text-sm text-gray-400">•</span>
                <Link
                  to="/privacy"
                  className="text-sm hover:text-gray-900 transition-colors"
                >
                  <span className="md:hidden">Privacy</span>
                  <span className="hidden md:inline">Privacy Policy</span>
                </Link>
                <span className="text-sm text-gray-400">•</span>
                <Link
                  to="/contact-us"
                  className="text-sm hover:text-gray-900 transition-colors"
                >
                  <span className="md:hidden">Contact</span>
                  <span className="hidden md:inline">Contact Us</span>
                </Link>
              </div>
            </div>

            {/* Copyright */}
            <div className="flex gap-4 items-center sm:ml-auto text-xs sm:text-sm text-gray-400 sm:text-gray-600">
              © {currentYear} Korte. All rights reserved.
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
