'use client';

import { useEffect, useState, createContext, useContext, type ReactNode } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  GraduationCap,
  Users,
  BookOpen,
  Wallet,
  CalendarCheck,
  UserCheck,
  Calendar,
  LogOut,
  Menu,
  ShieldAlert,
  ChevronLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface SchoolUser {
  id: string;
  email: string;
  name: string;
  tenant: { id: string; name: string; subdomain: string; status: string };
  role: { id: string; name: string; description: string | null; permissions: string } | null;
}

interface SchoolContextType {
  user: SchoolUser | null;
  tenantId: string;
  loading: boolean;
}

const SchoolContext = createContext<SchoolContextType>({
  user: null,
  tenantId: '',
  loading: true,
});

export function useSchool() {
  return useContext(SchoolContext);
}

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { label: 'Students', icon: GraduationCap, href: '/students' },
  { label: 'Staff', icon: Users, href: '/staff' },
  { label: 'Classes', icon: BookOpen, href: '/classes' },
  { label: 'Fees', icon: Wallet, href: '/fees' },
  { label: 'Attendance', icon: CalendarCheck, href: '/attendance' },
  { label: 'Guardians', icon: UserCheck, href: '/guardians' },
  { label: 'Academic Years', icon: Calendar, href: '/academic-years' },
];

function SidebarContent({
  tenantId,
  pathname,
  collapsed,
  onNavigate,
}: {
  tenantId: string;
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const basePath = `/school/${tenantId}`;

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-gray-100 shrink-0">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-600 text-white shrink-0">
          <GraduationCap className="w-5 h-5" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="font-semibold text-sm text-gray-900 truncate">SchoolManSys</p>
            <p className="text-[10px] text-gray-400 truncate">School Portal</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-3 px-3">
        <nav className="space-y-1">
          {navItems.map((item) => {
            const href = `${basePath}${item.href}`;
            const isActive = pathname === href || (item.href !== '/dashboard' && pathname.startsWith(href));
            return (
              <Link
                key={item.href}
                href={href}
                onClick={onNavigate}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                  collapsed && 'justify-center px-2'
                )}
              >
                <item.icon className={cn('w-5 h-5 shrink-0', isActive && 'text-emerald-600')} />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>
    </div>
  );
}

function MobileSidebar({
  tenantId,
  pathname,
  user,
}: {
  tenantId: string;
  pathname: string;
  user: SchoolUser | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden shrink-0">
          <Menu className="w-5 h-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>Navigation</SheetTitle>
        </SheetHeader>
        <SidebarContent tenantId={tenantId} pathname={pathname} collapsed={false} onNavigate={() => setOpen(false)} />
        {user && (
          <div className="border-t border-gray-100 px-4 py-3">
            <p className="text-xs font-medium text-gray-500 truncate">{user.tenant?.name}</p>
            <p className="text-xs text-gray-400 truncate">{user.name}</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Header({ user, tenantId }: { user: SchoolUser | null; tenantId: string }) {
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await fetch('/api/auth/school/logout', { method: 'POST' });
      toast.success('Signed out');
      router.push(`/school/${tenantId}/login`);
    } catch {
      toast.error('Failed to sign out');
    }
  };

  return (
    <header className="h-16 border-b border-gray-200 bg-white flex items-center justify-between px-4 lg:px-6 shrink-0">
      <div className="flex items-center gap-3">
        <MobileSidebar tenantId={tenantId} pathname={usePathname()} user={user} />
        <div className="hidden lg:block">
          <h2 className="text-sm font-semibold text-gray-900">{user?.tenant?.name || 'School Portal'}</h2>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {user && (
          <>
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-gray-900">{user.name}</p>
              <p className="text-xs text-gray-500">{user.email}</p>
            </div>
            {user.role && (
              <Badge variant="secondary" className="hidden sm:inline-flex bg-emerald-50 text-emerald-700 border-emerald-200">
                {user.role.name}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              className="text-gray-500 hover:text-gray-700"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </>
        )}
      </div>
    </header>
  );
}

export default function SchoolLayout({ children }: { children: ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const tenantId = params.tenantId as string;

  const [user, setUser] = useState<SchoolUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Redirect if we're on the login page - don't check auth
  const isLoginPage = pathname.endsWith('/login');

  useEffect(() => {
    if (isLoginPage) {
      setLoading(false);
      return;
    }

    // Re-enter loading state when navigating away from login
    setLoading(true);

    async function fetchUser() {
      try {
        const res = await fetch('/api/auth/school/me');
        const data = await res.json();

        if (data.success) {
          // Verify tenant matches
          if (data.data.tenant?.id !== tenantId) {
            router.push(`/school/${tenantId}/login`);
            return;
          }
          setUser(data.data);
        } else {
          router.push(`/school/${tenantId}/login`);
        }
      } catch {
        router.push(`/school/${tenantId}/login`);
      } finally {
        setLoading(false);
      }
    }

    fetchUser();
  }, [tenantId, router, isLoginPage]);

  // Login page renders without chrome
  if (isLoginPage) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex">
        <div className="w-64 border-r border-gray-200 bg-gray-50 p-4 hidden lg:block">
          <Skeleton className="h-10 w-full mb-6" />
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </div>
        <div className="flex-1">
          <div className="h-16 border-b border-gray-200 flex items-center px-6">
            <Skeleton className="h-8 w-48" />
          </div>
          <div className="p-6">
            <Skeleton className="h-[600px] w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <SchoolContext.Provider value={{ user, tenantId, loading }}>
      <div className="min-h-screen flex bg-gray-50" suppressHydrationWarning>
        {/* Desktop sidebar */}
        <aside
          className={cn(
            'hidden lg:flex flex-col border-r border-gray-200 bg-white transition-all duration-300 shrink-0',
            sidebarCollapsed ? 'w-16' : 'w-64'
          )}
        >
          <SidebarContent tenantId={tenantId} pathname={pathname} collapsed={sidebarCollapsed} />
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Impersonation banner */}
          <div className="bg-red-600 text-white text-xs text-center py-1.5 font-medium hidden">
            <ShieldAlert className="w-3 h-3 inline mr-1.5" />
            You are viewing this portal in impersonation mode
          </div>

          <Header user={user} tenantId={tenantId} />

          <main className="flex-1 overflow-auto">
            <div className="p-4 lg:p-6 max-w-7xl mx-auto">
              {children}
            </div>
          </main>

          {/* Footer */}
          <footer className="border-t border-gray-200 bg-white py-3 px-4 text-center text-xs text-gray-400 shrink-0">
            &copy; 2026 SchoolManSys &mdash; School Management System
          </footer>
        </div>

        {/* Sidebar collapse toggle */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="hidden lg:flex fixed bottom-6 items-center justify-center w-7 h-7 rounded-full bg-white border border-gray-200 shadow-sm text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors z-10"
          style={{ left: sidebarCollapsed ? 'calc(4rem - 14px)' : 'calc(16rem - 14px)' }}
        >
          <ChevronLeft className={cn('w-3.5 h-3.5 transition-transform', sidebarCollapsed && 'rotate-180')} />
        </button>
      </div>
    </SchoolContext.Provider>
  );
}
