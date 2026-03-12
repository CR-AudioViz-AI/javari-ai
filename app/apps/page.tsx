export const dynamic = 'force-dynamic'
// javariai.com/apps - Apps Redirect
// Redirects to the main CR AudioViz AI apps page

import { redirect } from 'next/navigation';

export default function AppsPage() {
  redirect('https://craudiovizai.com/apps');
}
