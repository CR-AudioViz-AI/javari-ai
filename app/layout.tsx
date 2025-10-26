import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Javari AI',
  description: 'Autonomous, Self-Healing AI Assistant',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
