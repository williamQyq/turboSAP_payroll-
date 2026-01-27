/**
 * AdminSidebar Component
 * Navigation sidebar for TurboSAP Admin interface
 * Uses same base colors as client sidebar with gold/amber accent for differentiation
 */

import { Link, useLocation } from 'react-router-dom';
import { cn } from '../../lib/utils.ts';
import { useAuthStore } from '../../store/auth';
import {
  LayoutDashboard,
  Users,
  Layers,
  Boxes,
  Settings,
  LogOut,
  FileJson,
  ChevronRight,
  Terminal,
  FileUp,
  Package,
} from 'lucide-react';

const adminNavItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/admin/dashboard', key: 'dashboard' },
  { icon: Users, label: 'Users', href: '/admin/users', key: 'users' },
  { icon: Layers, label: 'Categories', href: '/admin/categories', key: 'categories' },
  { icon: Boxes, label: 'Configuration', href: '/admin/config', key: 'config' },
  { icon: Package, label: 'Modules', href: '/admin/modules', key: 'modules' },
  { icon: FileUp, label: 'Documents', href: '/admin/documents', key: 'documents' },
  { icon: Terminal, label: 'Console', href: '/admin/console', key: 'console' },
  { icon: Settings, label: 'Settings', href: '/admin/settings', key: 'settings' },
];

export function AdminSidebar() {
  const location = useLocation();
  const pathname = location.pathname;
  const { user, clearAuth } = useAuthStore();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 gradient-sidebar border-r border-sidebar-border">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-600">
            <FileJson className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-sidebar-foreground">TurboSAP</h1>
            <p className="text-xs text-amber-400">Admin Console</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {adminNavItems.map((item) => {
            // Special case: Configuration should also be active on /admin/modules/* paths
            const isActive =
              pathname === item.href ||
              pathname.startsWith(item.href + '/') ||
              (item.key === 'config' && pathname.startsWith('/admin/modules/'));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-amber-600/20 text-amber-400'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                )}
              >
                <Icon className={cn(
                  'h-5 w-5',
                  isActive ? 'text-amber-400' : 'text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80'
                )} />
                <span className="flex-1">{item.label}</span>
                <ChevronRight
                  className={cn(
                    'h-4 w-4 opacity-0 transition-all duration-200',
                    isActive && 'opacity-100 text-amber-400',
                    'group-hover:opacity-100'
                  )}
                />
              </Link>
            );
          })}
        </nav>

        {/* User Section */}
        <div className="border-t border-sidebar-border p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-600/20 text-sm font-medium text-amber-400">
              {user?.username?.substring(0, 2).toUpperCase() || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-sidebar-foreground">{user?.username || 'Admin'}</p>
              <p className="truncate text-xs text-amber-400 capitalize">{user?.role || 'Admin'}</p>
            </div>
          </div>
          <div className="space-y-1">
            <Link
              to="/admin/settings"
              className={cn(
                "w-full flex items-center justify-start gap-2 px-3 py-2 text-sm rounded-lg transition-colors",
                pathname === '/admin/settings'
                  ? 'bg-amber-600/20 text-amber-400'
                  : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
              )}
            >
              <Settings className="h-4 w-4" />
              Settings
            </Link>
            <button
              onClick={clearAuth}
              className="w-full flex items-center justify-start gap-2 px-3 py-2 text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 rounded-lg transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
