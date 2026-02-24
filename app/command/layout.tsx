/**
 * app/command/layout.tsx
 * Command Center Layout
 * Created: 2026-02-22 03:01 ET
 * 
 * Wraps all Command Center pages with:
 * - Admin access validation
 * - Sidebar navigation
 * - Header with system status
 * - Responsive mobile-friendly design
 */

import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/command/Sidebar';
import { Header } from '@/components/command/Header';
import { checkAdminAccess, getCurrentUserId } from '@/lib/command/checkAdmin';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Command Center | Javari OS',
  description: 'Autonomous operations control center for Javari AI',
};

export default async function CommandLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Get current user ID
  const userId = await getCurrentUserId();

  // Check admin access
  const { isAdmin, error } = await checkAdminAccess(userId);

  // Redirect unauthorized users
  if (!isAdmin) {
    console.warn('[Command Center] Unauthorized access attempt:', { userId, error });
    redirect('/');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div className="lg:pl-64">
        {/* Header */}
        <Header />

        {/* Page content */}
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
