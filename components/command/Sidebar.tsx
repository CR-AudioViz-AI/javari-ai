/**
 * components/command/Sidebar.tsx
 * Command Center Sidebar Navigation
 * Created: 2026-02-22 02:59 ET
 * 
 * Provides navigation to all Command Center sections
 * Collapses on mobile, responsive design
 */

'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import {
  HomeIcon,
  ChartBarIcon,
  ClockIcon,
  CommandLineIcon,
  MapIcon,
  LightBulbIcon,
  SignalIcon,
  ExclamationTriangleIcon,
  Bars3Icon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { name: 'Dashboard', href: '/command', icon: HomeIcon },
  { name: 'Status', href: '/command/status', icon: ChartBarIcon },
  { name: 'History', href: '/command/history', icon: ClockIcon },
  { name: 'Control', href: '/command/control', icon: CommandLineIcon },
  { name: 'Roadmap', href: '/command/roadmap', icon: MapIcon },
  { name: 'Explain', href: '/command/explain', icon: LightBulbIcon },
  { name: 'Telemetry', href: '/command/telemetry', icon: SignalIcon },
  { name: 'Drift', href: '/command/drift', icon: ExclamationTriangleIcon },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Hydration-safe guard
  useEffect(() => {
    setMounted(true);
    setIsOpen(false);
  }, []);

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-md bg-gray-900 text-white hover:bg-gray-800"
        aria-label="Toggle menu"
      >
        {isOpen ? (
          <XMarkIcon className="h-6 w-6" />
        ) : (
          <Bars3Icon className="h-6 w-6" />
        )}
      </button>

      {/* Backdrop for mobile - Only after mount */}
      {mounted && isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-40 h-screen w-64 
          bg-gray-900 text-white transition-transform duration-300
          ${mounted && isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-center h-16 border-b border-gray-800">
            <h1 className="text-xl font-bold tracking-tight">
              <span className="text-blue-400">Javari</span> Command
            </h1>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-4">
            <ul className="space-y-1 px-3">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setIsOpen(false)}
                      className={`
                        flex items-center gap-3 px-3 py-2 rounded-md
                        transition-colors duration-150
                        ${
                          isActive
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                        }
                      `}
                    >
                      <Icon className="h-5 w-5 flex-shrink-0" />
                      <span className="font-medium">{item.name}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Footer */}
          <div className="border-t border-gray-800 p-4">
            <div className="text-xs text-gray-500">
              <p className="font-semibold text-gray-400 mb-1">Command Center</p>
              <p>Autonomous Operations</p>
              <p className="mt-2">Build {process.env.NEXT_PUBLIC_BUILD_ID || 'dev'}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
