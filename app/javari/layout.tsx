/**
 * JAVARI OS - NESTED LAYOUT (Proper Next.js Structure)
 * 
 * This is a NESTED layout that wraps /javari/* routes.
 * It does NOT replace the root layout - it works WITH it.
 * 
 * Next.js Layout Hierarchy:
 * app/layout.tsx (ROOT - provides html/body)
 *   └─ app/javari/layout.tsx (NESTED - provides Javari-specific context)
 *      └─ page.tsx (content)
 * 
 * Architecture:
 * - NO <html> or <body> tags (only root layout has these)
 * - Provides full-screen container for Javari OS
 * - Wraps children with Javari-specific providers
 * - Root layout handles navigation hiding via pathname detection
 * 
 * @version 3.0.0 - VALID NESTED LAYOUT
 * @timestamp Monday, February 24, 2026 at 1:18 AM EST
 */

'use client'

import { UserProfileProvider } from '@/components/user-profile/user-profile-context'
import { SplitScreenProvider } from '@/components/split-screen/split-screen-context'

export default function JavariLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <UserProfileProvider>
      <SplitScreenProvider>
        {/* Full-screen Javari OS container */}
        <div className="fixed inset-0 w-full h-full overflow-hidden bg-black">
          {children}
        </div>
      </SplitScreenProvider>
    </UserProfileProvider>
  )
}

