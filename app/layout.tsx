// app/layout.tsx
// Javari AI - Mobile-Optimized Layout
// Timestamp: Thursday, December 25, 2025 - 6:15 PM EST
'use client';

import { usePathname } from 'next/navigation';
import './globals.css'
import { UserProfileProvider } from '@/components/user-profile/user-profile-context'
import { SplitScreenProvider } from '@/components/split-screen/split-screen-context'
import { UserProfileButton } from '@/components/user-profile/UserProfileButton'
import { CreditsBar } from '@/components/credits/CreditsBar'
import { HeaderLogo } from '@/components/header/HeaderLogo'
import { EmbedAuthReceiver } from '@/components/EmbedAuthReceiver'
import { JavariErrorBoundary } from '@/lib/error-handler'

// Viewport configuration for mobile
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname();
  const isJavariRoute = pathname?.startsWith('/javari');

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        {/* Prevent iOS zoom on input focus */}
        <meta name="format-detection" content="telephone=no" />
      </head>
      <body className="min-h-screen min-h-[100dvh] bg-background font-sans antialiased">
        <JavariErrorBoundary>
          {/* Embed Auth Receiver - handles auth when embedded in website */}
          <EmbedAuthReceiver />
          
          {/* Wrap everything in providers */}
          <UserProfileProvider>
            <SplitScreenProvider>
              {isJavariRoute ? (
                // Javari route - NO header/footer for embedding
                children
              ) : (
                // Regular routes - WITH header/footer
                <div className="relative flex min-h-screen min-h-[100dvh] flex-col">
                  {/* Header with Credits Bar - Mobile Optimized */}
                  <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                    <div className="container px-4 flex h-14 md:h-16 items-center justify-between">
                      {/* Logo and Title */}
                      <div className="flex items-center gap-2 min-h-[48px]">
                        <HeaderLogo />
                      </div>

                      {/* Credits Bar (right side of header) */}
                      <div className="flex items-center gap-2 md:gap-4 min-h-[48px]">
                        <CreditsBar />
                      </div>
                    </div>
                  </header>

                  {/* Main content area - Full height minus header/footer */}
                  <main className="flex-1 overflow-hidden">
                    {children}
                  </main>

                  {/* User Profile Button (bottom-left, fixed position) */}
                  <UserProfileButton />

                  {/* Footer - Simplified for mobile */}
                  <footer className="border-t py-4 md:py-6 pb-safe">
                    <div className="container px-4 flex flex-col items-center justify-between gap-3 md:flex-row">
                      <p className="text-xs md:text-sm text-muted-foreground text-center">
                        © {new Date().getFullYear()} CR AudioViz AI, LLC
                      </p>
                      <div className="flex gap-4 text-xs md:text-sm text-muted-foreground">
                        <a href="/privacy" className="hover:underline min-h-[44px] flex items-center">Privacy</a>
                        <a href="/terms" className="hover:underline min-h-[44px] flex items-center">Terms</a>
                        <a href="/support" className="hover:underline min-h-[44px] flex items-center">Support</a>
                      </div>
                    </div>
                  </footer>
                </div>
              )}
            </SplitScreenProvider>
          </UserProfileProvider>
        </JavariErrorBoundary>
      </body>
    </html>
  )
}
