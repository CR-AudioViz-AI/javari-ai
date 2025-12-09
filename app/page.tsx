/**
 * JAVARI AI - HOMEPAGE
 * Server-side redirect to /javari chat interface
 */

import { redirect } from 'next/navigation';

export default function HomePage() {
  redirect('/javari');
}
