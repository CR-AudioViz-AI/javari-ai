// app/layout.tsx
'use client';

import { usePathname } from 'next/navigation';
import type { Metadata } from 'next'
import './globals.css'
import { UserProfileProvider } from '@/components/user-profile/user-profile-context'
import { SplitScreenProvider } from '@/components/split-screen/split-screen-context'
import { UserProfileButton } from '@/components/user-profile/UserProfileButton'
import { CreditsBar } from '@/components/credits/CreditsBar'
import { HeaderLogo } from '@/components/header/HeaderLogo'

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
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        {/* Wrap everything in providers */}
        <UserProfileProvider>
          <SplitScreenProvider>
            {isJavariRoute ? (
              // Javari route - NO header/footer for embedding
              children
            ) : (
              // Regular routes - WITH header/footer
              <div className="relative flex min-h-screen flex-col">
                {/* Header with Credits Bar */}
                <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                  <div className="container flex h-14 items-center justify-between">
                    {/* Logo and Title */}
                    <div className="flex items-center gap-2">
                      <HeaderLogo />
                    </div>

                    {/* Credits Bar (right side of header) */}
                    <div className="flex items-center gap-4">
                      <CreditsBar />
                    </div>
                  </div>
                </header>

                {/* Main content area */}
                <main className="flex-1">
                  {children}
                </main>

                {/* User Profile Button (bottom-left, fixed position) */}
                <UserProfileButton />

                {/* Footer */}
                <footer className="border-t py-6">
                  <div className="container flex flex-col items-center justify-between gap-4 md:flex-row">
                    <p className="text-sm text-muted-foreground">
                      © {new Date().getFullYear()} CR AudioViz AI, LLC. All rights reserved.
                    </p>
                    <div className="flex gap-4 text-sm text-muted-foreground">
                      <a href="/privacy" className="hover:underline">Privacy</a>
                      <a href="/terms" className="hover:underline">Terms</a>
                      <a href="/support" className="hover:underline">Support</a>
                    </div>
                  </div>
                </footer>
              </div>
            )}
          </SplitScreenProvider>
        </UserProfileProvider>
      </body>
    </html>
  )
}
