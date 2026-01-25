/**
 * Javari AI - Dashboard Page
 * SPEC 08 — First Real Application Pages
 * 
 * Main dashboard with data table layout
 * - Uses PageHeader for title/actions
 * - Table components for data display
 * - DataEmptyState for empty table state
 * - No data fetching, ready for integration
 * 
 * @version 1.0.0
 * @spec SPEC 08
 * @timestamp Tuesday, January 28, 2025 at 12:30 PM EST
 */

import { PageHeader } from '@/components/templates/PageHeader'
import { PageSection } from '@/components/templates/PageSection'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Table, TableHeader, TableRow, TableCell } from '@/components/data/Table'
import { DataEmptyState } from '@/components/data/DataEmptyState'

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Projects"
        description="Manage and monitor all your projects in one place."
        actions={
          <>
            <Button variant="outline" size="sm">
              Import
            </Button>
            <Button variant="primary" size="sm">
              New Project
            </Button>
          </>
        }
      />

      <PageSection className="pt-6">
        <Card>
          <CardContent>
            <Table>
              <thead>
                <tr>
                  <TableHeader>Project Name</TableHeader>
                  <TableHeader>Status</TableHeader>
                  <TableHeader>Team</TableHeader>
                  <TableHeader>Last Updated</TableHeader>
                  <TableHeader>Actions</TableHeader>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <TableCell colSpan={5}>
                    <DataEmptyState
                      title="No projects found"
                      description="Create your first project to organize your work and start collaborating."
                      action={
                        <Button variant="primary">
                          Create Project
                        </Button>
                      }
                    />
                  </TableCell>
                </tr>
              </tbody>
            </Table>
          </CardContent>
        </Card>
      </PageSection>

      <PageSection title="Quick Actions" description="Common tasks and workflows" className="pt-8 pb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="transition-shadow duration-fast hover:shadow-md">
            <CardContent>
              <div className="py-4">
                <h3 className="font-medium text-foreground mb-2">
                  Import Data
                </h3>
                <p className="text-sm text-foreground/60 mb-4">
                  Import from CSV or JSON
                </p>
                <Button variant="outline" size="sm" className="w-full">
                  Import
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="transition-shadow duration-fast hover:shadow-md">
            <CardContent>
              <div className="py-4">
                <h3 className="font-medium text-foreground mb-2">
                  Team Settings
                </h3>
                <p className="text-sm text-foreground/60 mb-4">
                  Manage members and roles
                </p>
                <Button variant="outline" size="sm" className="w-full">
                  Manage
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="transition-shadow duration-fast hover:shadow-md">
            <CardContent>
              <div className="py-4">
                <h3 className="font-medium text-foreground mb-2">
                  Analytics
                </h3>
                <p className="text-sm text-foreground/60 mb-4">
                  View insights and metrics
                </p>
                <Button variant="outline" size="sm" className="w-full">
                  View
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="transition-shadow duration-fast hover:shadow-md">
            <CardContent>
              <div className="py-4">
                <h3 className="font-medium text-foreground mb-2">
                  Documentation
                </h3>
                <p className="text-sm text-foreground/60 mb-4">
                  Learn how to use the platform
                </p>
                <Button variant="outline" size="sm" className="w-full">
                  Read Docs
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </PageSection>
    </>
  )
}
