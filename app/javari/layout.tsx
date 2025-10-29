import './globals.css';
import { Inter } from 'next/font/google';
import { UserProfileProvider } from '@/components/user-profile/user-profile-context';
import { SplitScreenProvider } from '@/components/split-screen/split-screen-context';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Javari AI - Autonomous Development Assistant',
  description: 'Your autonomous AI partner that never forgets, self-heals, and continuously learns.',
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
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className={`min-h-screen bg-background font-sans antialiased ${inter.className}`}>
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
