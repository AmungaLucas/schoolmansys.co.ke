'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  LayoutDashboard,
  School,
  CreditCard,
  Receipt,
  LogOut,
  GraduationCap,
  Menu,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

const navItems = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/schools', label: 'Schools', icon: School },
  { href: '/admin/plans', label: 'Plans', icon: CreditCard },
  { href: '/admin/payments', label: 'Payments', icon: Receipt },
];

function SidebarContent({ admin, pathname, onNavigate }: { admin: AdminUser; pathname: string; onNavigate?: () => void }) {
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/admin/logout', { method: 'POST' });
      toast.success('Logged out successfully');
      window.location.href = '/admin/login';
    } catch {
      toast.error('Failed to log out');
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 h-16 border-b border-emerald-800">
        <div className="w-9 h-9 bg-white/15 rounded-lg flex items-center justify-center">
          <GraduationCap className="w-5 h-5 text-white" />
        </div>
        <div>
          <span className="text-lg font-bold text-white">SchoolManSys</span>
          <p className="text-xs text-emerald-200 -mt-0.5">Super Admin</p>
        </div>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-4">
        <nav className="space-y-1 px-3">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/admin/dashboard' && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-white/15 text-white'
                    : 'text-emerald-100 hover:bg-white/10 hover:text-white'
                )}
              >
                <Icon className="w-4.5 h-4.5" />
                {item.label}
                {isActive && (
                  <ChevronRight className="w-4 h-4 ml-auto text-emerald-200" />
                )}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      {/* User info + Logout */}
      <div className="border-t border-emerald-800 p-4">
        <div className="flex items-center gap-3 mb-3 px-2">
          <div className="w-9 h-9 bg-emerald-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
            {admin.name?.charAt(0)?.toUpperCase() || 'A'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{admin.name}</p>
            <p className="text-xs text-emerald-200 truncate">{admin.email}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start text-emerald-100 hover:bg-white/10 hover:text-white"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Login page renders without the chrome (sidebar, header, auth guard)
  const isLoginPage = pathname === '/admin/login';

  useEffect(() => {
    // Skip auth check on login page
    if (isLoginPage) {
      setLoading(false);
      return;
    }

    // Re-enter loading state when navigating away from login
    setLoading(true);

    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/admin/me');
        const data = await res.json();
        if (!res.ok || !data.success) {
          router.replace('/admin/login');
          return;
        }
        setAdmin(data.data);
      } catch {
        router.replace('/admin/login');
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, [router, isLoginPage]);

  // Login page renders without chrome — just the children
  if (isLoginPage) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex" suppressHydrationWarning>
        <div className="hidden lg:flex w-64 bg-emerald-800 flex-col p-4 gap-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
        <div className="flex-1 p-8">
          <Skeleton className="h-16 w-full mb-6" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!admin) return null;

  return (
    <div className="min-h-screen flex bg-muted/30" suppressHydrationWarning>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 bg-emerald-800 flex-col flex-shrink-0">
        <SidebarContent admin={admin} pathname={pathname} />
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 p-0 bg-emerald-800 border-emerald-700">
          <SidebarContent
            admin={admin}
            pathname={pathname}
            onNavigate={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top header bar */}
        <header className="h-16 bg-background border-b flex items-center justify-between px-4 lg:px-8 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-md hover:bg-muted"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:block">
              <h2 className="text-sm font-medium text-foreground">
                {navItems.find((i) => pathname === i.href || (i.href !== '/admin/dashboard' && pathname.startsWith(i.href)))?.label || 'Admin Panel'}
              </h2>
              <p className="text-xs text-muted-foreground">
                {pathname === '/admin/dashboard' ? 'Overview of your schools' :
                 pathname === '/admin/schools' ? 'Manage school tenants' :
                 pathname === '/admin/plans' ? 'Manage subscription plans' :
                 pathname === '/admin/payments' ? 'View payment transactions' :
                 'Administration'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                <span className="text-emerald-700 font-semibold text-sm">
                  {admin.name?.charAt(0)?.toUpperCase() || 'A'}
                </span>
              </div>
              <div className="hidden md:block">
                <p className="text-sm font-medium leading-none">{admin.name}</p>
                <p className="text-xs text-muted-foreground">{admin.role}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
