import '../globals.css';
import { UserProfileProvider } from '@/components/user-profile/user-profile-context';
import { SplitScreenProvider } from '@/components/split-screen/split-screen-context';

export const metadata = {
  title: 'Javari AI - Autonomous Development Assistant',
  description: 'Your autonomous AI partner that never forgets, self-heals, and continuously learns.',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
};

export default function JavariLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        <UserProfileProvider>
          <SplitScreenProvider>
            {/* NO HEADER OR FOOTER - For embedding in main website */}
            {children}
          </SplitScreenProvider>
        </UserProfileProvider>
      </body>
    </html>
  );
}
