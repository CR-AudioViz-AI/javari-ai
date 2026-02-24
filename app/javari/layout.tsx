/**
 * JAVARI LAYOUT
 * 
 * Full-screen immersive layout for Javari OS
 * Hides global navigation to provide complete OS experience
 * Providers for Javari-specific state management
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
        {/* Full-screen container - hides TopNav via CSS */}
        <div className="fixed inset-0 z-50 bg-black">
          {children}
        </div>
      </SplitScreenProvider>
    </UserProfileProvider>
  );
}
