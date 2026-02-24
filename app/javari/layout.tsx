/**
 * JAVARI LAYOUT
 * 
 * Provider wrapper for Javari-specific features
 * Does NOT create nested html/body - inherits from root layout
 * Navigation hiding handled by root layout pathname detection
 */

import { UserProfileProvider } from '@/components/user-profile/user-profile-context';
import { SplitScreenProvider } from '@/components/split-screen/split-screen-context';

export default function JavariLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UserProfileProvider>
      <SplitScreenProvider>
        {children}
      </SplitScreenProvider>
    </UserProfileProvider>
  );
}
