'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  MessageSquare,
  Brain,
  Activity,
  Settings,
  History,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  {
    title: 'Overview',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'Chat History',
    href: '/dashboard/history',
    icon: History,
  },
  {
    title: 'Knowledge',
    href: '/dashboard/knowledge',
    icon: Brain,
  },
  {
    title: 'System Status',
    href: '/dashboard/status',
    icon: Activity,
  },
  {
    title: 'Analytics',
    href: '/dashboard/analytics',
    icon: BarChart3,
  },
  {
    title: 'Settings',
    href: '/dashboard/settings',
    icon: Settings,
  },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 p-4">
      {navItems.map((item) => {
        const isActive = pathname === item.href || 
          (item.href !== '/dashboard' && pathname?.startsWith(item.href));
        
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.title}
          </Link>
        );
      })}
    </nav>
  );
}
