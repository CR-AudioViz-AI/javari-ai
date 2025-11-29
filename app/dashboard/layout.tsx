import { DashboardNav } from '@/components/dashboard-nav';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r bg-background">
        <div className="p-4 border-b">
          <h2 className="font-bold text-lg">Javari Dashboard</h2>
          <p className="text-xs text-muted-foreground">Manage your AI assistant</p>
        </div>
        <DashboardNav />
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
