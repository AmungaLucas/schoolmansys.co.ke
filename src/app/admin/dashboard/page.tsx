'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  School,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Plus,
  ArrowRight,
  Activity,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface DashboardData {
  totalSchools: number;
  activeSchools: number;
  expiredSchools: number;
  provisioningFailed: number;
  recentAuditLogs: Array<{
    id: string;
    action: string;
    entityType: string;
    details: string;
    createdAt: string;
    actor: { name: string; email: string } | null;
  }>;
}

function MetricCard({
  title,
  value,
  icon: Icon,
  description,
  variant = 'default',
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  description?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}) {
  const colorMap = {
    default: 'bg-white text-foreground border',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    danger: 'bg-red-50 text-red-700 border-red-200',
  };

  const iconBgMap = {
    default: 'bg-muted text-muted-foreground',
    success: 'bg-emerald-100 text-emerald-600',
    warning: 'bg-amber-100 text-amber-600',
    danger: 'bg-red-100 text-red-600',
  };

  return (
    <Card className={colorMap[variant]}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium opacity-70">{title}</p>
            <p className="text-3xl font-bold mt-2">{value}</p>
            {description && (
              <p className="text-xs mt-1 opacity-60">{description}</p>
            )}
          </div>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconBgMap[variant]}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await fetch('/api/admin/dashboard');
        const json = await res.json();
        if (!res.ok || !json.success) {
          setError(json.error?.message || 'Failed to load dashboard');
          return;
        }
        setData(json.data);
      } catch {
        setError('Network error. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your schools</p>
        </div>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!data) return null;

  const suspendedCount = data.totalSchools - data.activeSchools - data.expiredSchools - data.provisioningFailed;

  const formatAction = (action: string) => {
    return action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your school management platform</p>
        </div>
        <div className="flex gap-3">
          <Button asChild>
            <Link href="/admin/schools">
              <School className="w-4 h-4 mr-2" />
              View All Schools
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/admin/schools">
              <Plus className="w-4 h-4 mr-2" />
              Create School
            </Link>
          </Button>
        </div>
      </div>

      {/* Warning banner */}
      {data.provisioningFailed > 0 && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-800">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle>Provisioning Issues Detected</AlertTitle>
          <AlertDescription>
            {data.provisioningFailed} school{data.provisioningFailed > 1 ? 's' : ''} failed during provisioning
            and may require manual intervention.
          </AlertDescription>
        </Alert>
      )}

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          title="Total Schools"
          value={data.totalSchools}
          icon={School}
          variant="default"
        />
        <MetricCard
          title="Active"
          value={data.activeSchools}
          icon={CheckCircle2}
          variant="success"
        />
        <MetricCard
          title="Suspended"
          value={Math.max(0, suspendedCount)}
          icon={XCircle}
          variant="warning"
        />
        <MetricCard
          title="Expired"
          value={data.expiredSchools}
          icon={Clock}
          variant="warning"
        />
        <MetricCard
          title="Provisioning Failed"
          value={data.provisioningFailed}
          icon={AlertTriangle}
          variant="danger"
        />
      </div>

      {/* Quick stats + Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick stats */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Platform Stats</CardTitle>
            <CardDescription>Quick overview of platform health</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Active Rate</span>
                <span className="text-sm font-semibold">
                  {data.totalSchools > 0
                    ? Math.round((data.activeSchools / data.totalSchools) * 100)
                    : 0}%
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-emerald-500 h-2 rounded-full transition-all"
                  style={{
                    width: `${data.totalSchools > 0 ? (data.activeSchools / data.totalSchools) * 100 : 0}%`,
                  }}
                />
              </div>
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-sm text-muted-foreground">Needs Attention</span>
                <Badge variant={data.provisioningFailed > 0 || data.expiredSchools > 0 ? 'destructive' : 'secondary'}>
                  {data.provisioningFailed + data.expiredSchools}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Recent Activity</CardTitle>
                <CardDescription>Latest audit log entries</CardDescription>
              </div>
              <Activity className="w-4 h-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {data.recentAuditLogs.length === 0 ? (
              <div className="text-center py-8">
                <Activity className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No recent activity</p>
              </div>
            ) : (
              <div className="space-y-1">
                {data.recentAuditLogs.slice(0, 5).map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="w-2 h-2 bg-emerald-500 rounded-full flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {formatAction(log.action)}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {log.actor?.name || 'System'} &middot; {log.entityType}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatTime(log.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
