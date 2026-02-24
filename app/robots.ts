// app/robots.ts - Robots.txt generation
import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/api/', '/command', '/video']
      }
    ],
    sitemap: 'https://javariai.com/sitemap.xml'
  }
}
