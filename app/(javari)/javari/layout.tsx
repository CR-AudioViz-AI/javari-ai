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
        <div className="fixed inset-0 w-full h-full overflow-hidden bg-black">
          {children}
        </div>
      </SplitScreenProvider>
    </UserProfileProvider>
  )
}
