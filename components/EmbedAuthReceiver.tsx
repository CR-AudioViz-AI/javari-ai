'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Auth Receiver for Javari AI
 * Listens for auth tokens from parent website and logs user in seamlessly
 * 
 * This should be added to the Javari app's layout or root page
 * 
 * Created: November 3, 2025
 */

// Allowed origins (update based on your domains)
const ALLOWED_ORIGINS = [
  'https://craudiovizai.com',
  'https://www.craudiovizai.com',
  'https://crav-website.vercel.app',
  'http://localhost:3000',
  process.env.NEXT_PUBLIC_WEBSITE_URL,
].filter(Boolean);

export function EmbedAuthReceiver() {
  const router = useRouter();

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // Security: Verify origin
      if (!ALLOWED_ORIGINS.some(origin => event.origin === origin)) {
        console.warn('Received message from untrusted origin:', event.origin);
        return;
      }

      // Handle auth token
      if (event.data?.type === 'AUTH_TOKEN') {
        const { token, user } = event.data;

        if (!token || !user) {
          console.error('Invalid auth data received');
          return;
        }

        try {
          // Option 1: Set the token in Supabase client
          // If using Supabase auth:
          if (typeof window !== 'undefined' && window.supabase) {
            await window.supabase.auth.setSession({
              access_token: token,
              refresh_token: '', // Add if available
            });
          }

          // Option 2: Set in localStorage for custom auth
          localStorage.setItem('auth_token', token);
          localStorage.setItem('user_data', JSON.stringify(user));

          // Option 3: Make API call to your auth endpoint
          // const response = await fetch('/api/auth/embed-login', {
          //   method: 'POST',
          //   headers: { 'Content-Type': 'application/json' },
          //   body: JSON.stringify({ token, user }),
          // });

          console.log('Auth received successfully for embed mode');
          
          // Refresh the page or router to apply new auth state
          router.refresh();

        } catch (error) {
          console.error('Error setting auth from embed:', error);
        }
      }
    };

    // Listen for messages from parent window
    window.addEventListener('message', handleMessage);

    // Send ready signal to parent
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'JAVARI_READY' }, '*');
    }

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [router]);

  // This component renders nothing
  return null;
}

/**
 * Usage in Javari app's layout.tsx or root page:
 * 
 * import { EmbedAuthReceiver } from '@/components/EmbedAuthReceiver';
 * 
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         <EmbedAuthReceiver />
 *         {children}
 *       </body>
 *     </html>
 *   );
 * }
 */
