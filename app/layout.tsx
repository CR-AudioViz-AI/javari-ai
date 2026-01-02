// app/layout.tsx - Root layout with SEO metadata
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL('https://javariai.com'),
  title: {
    default: 'Javari AI - Your AI Business Partner | CR AudioViz AI',
    template: '%s | Javari AI'
  },
  description: 'Javari AI is your autonomous business partner. Use voice commands, video calls, and natural language to manage revenue, users, deployments, and more. Start free today.',
  keywords: ['AI assistant', 'business automation', 'voice commands', 'AI COO', 'business management', 'SaaS tools', 'productivity AI'],
  authors: [{ name: 'CR AudioViz AI, LLC' }],
  creator: 'CR AudioViz AI, LLC',
  publisher: 'CR AudioViz AI, LLC',
  formatDetection: {
    email: false,
    telephone: false
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://javariai.com',
    siteName: 'Javari AI',
    title: 'Javari AI - Your AI Business Partner',
    description: 'Run your business with voice commands. Javari AI manages revenue, users, deployments, and more autonomously.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Javari AI - Your AI Business Partner'
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Javari AI - Your AI Business Partner',
    description: 'Run your business with voice commands. Start free with 50 credits.',
    images: ['/og-image.png'],
    creator: '@craudiovizai'
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1
    }
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png'
  },
  manifest: '/site.webmanifest',
  alternates: {
    canonical: 'https://javariai.com'
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SoftwareApplication',
              name: 'Javari AI',
              applicationCategory: 'BusinessApplication',
              operatingSystem: 'Web',
              offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'USD'
              },
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: '4.9',
                ratingCount: '150'
              }
            })
          }}
        />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  )
}
