// app/settings/page.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  User, 
  CreditCard, 
  Shield, 
  Globe, 
  Bell, 
  Palette,
  ChevronRight,
  Settings as SettingsIcon
} from 'lucide-react'

interface UserProfile {
  email: string
  full_name: string
  avatar_url?: string
  language: string
  created_at: string
}

interface Credits {
  remaining: number
  total: number
  plan_badge: string
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [credits, setCredits] = useState<Credits | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        // Load profile
        const profileRes = await fetch('/api/user/profile')
        if (profileRes.ok) {
          const profileData = await profileRes.json()
          setProfile(profileData.profile)
        }

        // Load credits
        const creditsRes = await fetch('/api/user/credits')
        if (creditsRes.ok) {
          const creditsData = await creditsRes.json()
          setCredits(creditsData.credits)
        }
      } catch (error) {
        console.error('Error loading settings data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const settingsSections = [
    {
      id: 'profile',
      title: 'Profile',
      description: 'Manage your account information and preferences',
      icon: User,
      href: '/settings/profile',
      badge: profile?.full_name || 'Not set',
    },
    {
      id: 'plans',
      title: 'Plans & Billing',
      description: 'Manage your subscription and payment methods',
      icon: CreditCard,
      href: '/settings/plans',
      badge: credits?.plan_badge || 'Free',
    },
    {
      id: 'security',
      title: 'Security',
      description: 'Password, two-factor authentication, and sessions',
      icon: Shield,
      href: '/settings/security',
    },
    {
      id: 'language',
      title: 'Language & Region',
      description: 'Set your language, timezone, and regional preferences',
      icon: Globe,
      href: '/settings/language',
      badge: profile?.language === 'es' ? 'Español' : 'English',
    },
    {
      id: 'notifications',
      title: 'Notifications',
      description: 'Configure email, push, and in-app notifications',
      icon: Bell,
      href: '/settings/notifications',
    },
    {
      id: 'appearance',
      title: 'Appearance',
      description: 'Customize theme, colors, and display settings',
      icon: Palette,
      href: '/settings/appearance',
    },
  ]

  return (
    <div className="container max-w-6xl py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <SettingsIcon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
            <p className="text-muted-foreground">
              Manage your account settings and preferences
            </p>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      )}

      {/* Settings Sections Grid */}
      {!loading && (
        <div className="grid gap-4 md:grid-cols-2">
          {settingsSections.map((section) => {
            const Icon = section.icon
            return (
              <Link key={section.id} href={section.href}>
                <Card className="transition-all hover:shadow-md hover:border-primary/50">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{section.title}</CardTitle>
                          {section.badge && (
                            <span className="text-xs text-muted-foreground">
                              {section.badge}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>{section.description}</CardDescription>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}

      {/* Quick Actions */}
      {!loading && (
        <div className="mt-8 rounded-lg border bg-muted/50 p-6">
          <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" size="sm" asChild>
              <Link href="/settings/profile">Edit Profile</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/settings/plans">Upgrade Plan</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/settings/security">Enable 2FA</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/help">Get Help</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
