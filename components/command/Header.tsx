/**
 * components/command/Header.tsx
 * Command Center Header
 * Created: 2026-02-22 03:00 ET
 * 
 * Shows Javari OS logo, system status, and admin user menu
 */

'use client';

import { useState } from 'react';
import { BoltIcon, UserCircleIcon } from '@heroicons/react/24/outline';

export function Header() {
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      {/* Logo and Title */}
      <div className="flex items-center gap-3">
        <BoltIcon className="h-8 w-8 text-blue-600" />
        <div>
          <h1 className="text-lg font-bold text-gray-900">Javari OS</h1>
          <p className="text-xs text-gray-500">Command Center</p>
        </div>
      </div>

      {/* System Status Indicator (Placeholder) */}
      <div className="flex items-center gap-4">
        <div className="hidden md:flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm text-gray-600 font-medium">System Online</span>
        </div>

        {/* User Menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-gray-100 transition-colors"
            aria-label="User menu"
          >
            <UserCircleIcon className="h-6 w-6 text-gray-600" />
            <span className="hidden md:inline text-sm font-medium text-gray-700">Admin</span>
          </button>

          {/* Dropdown Menu */}
          {showUserMenu && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowUserMenu(false)}
              />

              {/* Menu */}
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-20">
                <a
                  href="/dashboard"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Main Dashboard
                </a>
                <a
                  href="/settings"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Settings
                </a>
                <div className="border-t border-gray-200 my-1" />
                <a
                  href="/api/auth/signout"
                  className="block px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  Sign Out
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
