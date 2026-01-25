/**
 * Javari AI - Home Page
 * SPEC 08 — First Real Application Pages
 * 
 * Dashboard landing page with overview widgets
 * - Uses PageHeader for title/description
 * - PageGrid for widget layout
 * - Cards for content containers
 * - DataEmptyState for placeholder content
 * - No data fetching, ready for integration
 * 
 * @version 1.0.0
 * @spec SPEC 08
 * @timestamp Tuesday, January 28, 2025 at 12:28 PM EST
 */

import { PageHeader } from '@/components/templates/PageHeader'
import { PageSection } from '@/components/templates/PageSection'
import { PageGrid } from '@/components/templates/PageGrid'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { DataEmptyState } from '@/components/data/DataEmptyState'

export default function Home() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Welcome back! Here's an overview of your activity."
        actions={
          <Button variant="primary">
            Create New Project
          </Button>
        }
      />

      <PageSection className="pt-6">
        <PageGrid columns={3}>
          {/* Quick Stats Cards */}
          <Card className="transition-shadow duration-fast hover:shadow-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-foreground/60">
                  Total Projects
                </h3>
                <Badge variant="default">Active</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">0</div>
              <p className="text-xs text-foreground/60 mt-1">
                Ready to start
              </p>
            </CardContent>
          </Card>

          <Card className="transition-shadow duration-fast hover:shadow-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-foreground/60">
                  Team Members
                </h3>
                <Badge variant="success">Ready</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">0</div>
              <p className="text-xs text-foreground/60 mt-1">
                Invite collaborators
              </p>
            </CardContent>
          </Card>

          <Card className="transition-shadow duration-fast hover:shadow-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-foreground/60">
                  Storage Used
                </h3>
                <Badge variant="default">Free Plan</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">0 GB</div>
              <p className="text-xs text-foreground/60 mt-1">
                10 GB available
              </p>
            </CardContent>
          </Card>
        </PageGrid>
      </PageSection>

      <PageSection title="Recent Projects" description="Your most recently updated projects" className="pt-8">
        <Card>
          <CardContent>
            <DataEmptyState
              title="No projects yet"
              description="Create your first project to organize your work and collaborate with your team."
              action={
                <Button variant="primary">
                  Create Project
                </Button>
              }
            />
          </CardContent>
        </Card>
      </PageSection>

      <PageSection title="Recent Activity" description="Updates and changes from your team" className="pt-8 pb-6">
        <Card>
          <CardContent>
            <DataEmptyState
              title="No recent activity"
              description="Activity from you and your team will appear here."
            />
          </CardContent>
        </Card>
      </PageSection>
    </>
  )
}
