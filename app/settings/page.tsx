/**
 * Javari AI - Settings Page
 * SPEC 08 — First Real Application Pages
 * 
 * Settings page with sidebar navigation
 * - Uses PageHeader for title
 * - PageSidebarLayout for settings navigation
 * - Cards for settings sections
 * - No data fetching, ready for integration
 * 
 * @version 1.0.0
 * @spec SPEC 08
 * @timestamp Tuesday, January 28, 2025 at 12:32 PM EST
 */

import { PageHeader } from '@/components/templates/PageHeader'
import { PageSection } from '@/components/templates/PageSection'
import { PageSidebarLayout } from '@/components/templates/PageSidebarLayout'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Separator } from '@/components/ui/Separator'

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Manage your account and application preferences."
      />

      <PageSidebarLayout
        sidebarPosition="left"
        sidebar={
          <div className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground mb-3">
              Settings
            </h3>
            <nav className="space-y-1">
              <a
                href="#profile"
                className="block px-3 py-2 text-sm rounded-md bg-surface text-foreground font-medium transition-colors duration-fast"
              >
                Profile
              </a>
              <a
                href="#account"
                className="block px-3 py-2 text-sm rounded-md text-foreground/60 hover:bg-surface hover:text-foreground transition-colors duration-fast focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
              >
                Account
              </a>
              <a
                href="#security"
                className="block px-3 py-2 text-sm rounded-md text-foreground/60 hover:bg-surface hover:text-foreground transition-colors duration-fast focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
              >
                Security
              </a>
              <a
                href="#notifications"
                className="block px-3 py-2 text-sm rounded-md text-foreground/60 hover:bg-surface hover:text-foreground transition-colors duration-fast focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
              >
                Notifications
              </a>
              <a
                href="#billing"
                className="block px-3 py-2 text-sm rounded-md text-foreground/60 hover:bg-surface hover:text-foreground transition-colors duration-fast focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
              >
                Billing
              </a>
            </nav>
          </div>
        }
      >
        <div className="space-y-8">
          {/* Profile Section */}
          <PageSection id="profile" title="Profile" description="Manage your public profile information" className="pt-6">
            <Card>
              <CardContent>
                <div className="space-y-6 py-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Full Name
                    </label>
                    <div className="px-3 py-2 border border-border rounded-md text-foreground/60 bg-surface">
                      Not set
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Email Address
                    </label>
                    <div className="px-3 py-2 border border-border rounded-md text-foreground/60 bg-surface">
                      user@example.com
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Bio
                    </label>
                    <div className="px-3 py-2 border border-border rounded-md text-foreground/60 bg-surface min-h-[100px]">
                      Tell us about yourself
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button variant="primary" size="sm">
                      Save Changes
                    </Button>
                    <Button variant="outline" size="sm">
                      Cancel
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </PageSection>

          <Separator />

          {/* Account Section */}
          <PageSection id="account" title="Account" description="Manage your account settings">
            <Card>
              <CardContent>
                <div className="space-y-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0 pr-4">
                      <h4 className="text-sm font-medium text-foreground">
                        Language
                      </h4>
                      <p className="text-sm text-foreground/60">
                        Choose your preferred language
                      </p>
                    </div>
                    <Button variant="outline" size="sm">
                      English (US)
                    </Button>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0 pr-4">
                      <h4 className="text-sm font-medium text-foreground">
                        Timezone
                      </h4>
                      <p className="text-sm text-foreground/60">
                        Set your local timezone
                      </p>
                    </div>
                    <Button variant="outline" size="sm">
                      UTC-5 (EST)
                    </Button>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0 pr-4">
                      <h4 className="text-sm font-medium text-error">
                        Delete Account
                      </h4>
                      <p className="text-sm text-foreground/60">
                        Permanently delete your account
                      </p>
                    </div>
                    <Button variant="outline" size="sm">
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </PageSection>

          <Separator />

          {/* Security Section */}
          <PageSection id="security" title="Security" description="Manage your security preferences" className="pb-6">
            <Card>
              <CardContent>
                <div className="space-y-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0 pr-4">
                      <h4 className="text-sm font-medium text-foreground">
                        Password
                      </h4>
                      <p className="text-sm text-foreground/60">
                        Last changed 30 days ago
                      </p>
                    </div>
                    <Button variant="outline" size="sm">
                      Change
                    </Button>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0 pr-4">
                      <h4 className="text-sm font-medium text-foreground">
                        Two-Factor Authentication
                      </h4>
                      <p className="text-sm text-foreground/60">
                        Extra layer of security
                      </p>
                    </div>
                    <Button variant="primary" size="sm">
                      Enable
                    </Button>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0 pr-4">
                      <h4 className="text-sm font-medium text-foreground">
                        Active Sessions
                      </h4>
                      <p className="text-sm text-foreground/60">
                        Manage your devices
                      </p>
                    </div>
                    <Button variant="outline" size="sm">
                      View
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </PageSection>
        </div>
      </PageSidebarLayout>
    </>
  )
}
