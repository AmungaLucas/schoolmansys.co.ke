'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Users,
  GraduationCap,
  BookOpen,
  Wallet,
  AlertTriangle,
  TrendingUp,
  Clock,
  ArrowRight,
  Plus,
  CreditCard,
  CalendarCheck,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useSchool } from '../layout';

interface DashboardData {
  totalStudents: number;
  activeStudents: number;
  totalStaff: number;
  activeStaff: number;
  totalClasses: number;
  totalGuardians: number;
  todayCollections: number;
  totalFeePayments: number;
  outstandingBalance: number;
  currentAcademicYear: { id: string; name: string } | null;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(amount);
}

export default function SchoolDashboardPage() {
  const { tenantId, user } = useSchool();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await fetch(`/api/school/${tenantId}/dashboard`);
        const json = await res.json();
        if (json.success) {
          setData(json.data);
        }
      } catch {
        // silent fail
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, [tenantId]);

  const basePath = `/school/${tenantId}`;

  const metrics = loading
    ? null
    : [
        { label: 'Total Students', value: data?.totalStudents ?? 0, icon: GraduationCap, color: 'text-emerald-600', bg: 'bg-emerald-50', href: '/students' },
        { label: 'Total Staff', value: data?.totalStaff ?? 0, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', href: '/staff' },
        { label: 'Total Classes', value: data?.totalClasses ?? 0, icon: BookOpen, color: 'text-amber-600', bg: 'bg-amber-50', href: '/classes' },
        { label: "Today's Collections", value: formatCurrency(data?.todayCollections ?? 0), icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50', href: '/fees', isAmount: true },
        { label: 'Outstanding Balances', value: formatCurrency(data?.outstandingBalance ?? 0), icon: Wallet, color: 'text-red-600', bg: 'bg-red-50', href: '/fees', isAmount: true },
        { label: 'Guardians', value: data?.totalGuardians ?? 0, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50', href: '/guardians' },
      ];

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Welcome back, {user?.name?.split(' ')[0] || 'User'}! Here&apos;s an overview of your school.
        </p>
        {data?.currentAcademicYear && (
          <Badge variant="secondary" className="mt-2 bg-emerald-50 text-emerald-700 border-emerald-200">
            <CalendarCheck className="w-3 h-3 mr-1" />
            {data.currentAcademicYear.name}
          </Badge>
        )}
      </div>

      {/* Metric cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                  <Skeleton className="h-10 w-10 rounded-lg" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {metrics!.map((metric) => (
            <Card
              key={metric.label}
              className="cursor-pointer hover:shadow-md transition-shadow border-0 shadow-sm"
              onClick={() => router.push(`${basePath}${metric.href}`)}
            >
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{metric.label}</p>
                    <p className={`text-2xl font-bold mt-1 ${metric.isAmount ? '' : 'text-gray-900'}`}>
                      {metric.value}
                    </p>
                  </div>
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${metric.bg}`}>
                    <metric.icon className={`w-5 h-5 ${metric.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Quick actions */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
              onClick={() => router.push(`${basePath}/students`)}
            >
              <Plus className="w-4 h-4" />
              Add Student
            </Button>
            <Button
              variant="outline"
              className="gap-2 border-blue-200 text-blue-700 hover:bg-blue-50"
              onClick={() => router.push(`${basePath}/fees`)}
            >
              <CreditCard className="w-4 h-4" />
              Record Payment
            </Button>
            <Button
              variant="outline"
              className="gap-2 border-amber-200 text-amber-700 hover:bg-amber-50"
              onClick={() => router.push(`${basePath}/attendance`)}
            >
              <CalendarCheck className="w-4 h-4" />
              Mark Attendance
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Info cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Alerts */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Alerts & Warnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : data ? (
              <div className="space-y-2">
                {data.outstandingBalance > 0 && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 border border-red-100">
                    <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-red-800">Outstanding Fees</p>
                      <p className="text-xs text-red-600">{formatCurrency(data.outstandingBalance)} in outstanding balances</p>
                    </div>
                    <Button variant="ghost" size="sm" className="ml-auto text-red-600 hover:text-red-700" onClick={() => router.push(`${basePath}/fees`)}>
                      <ArrowRight className="w-3 h-3" />
                    </Button>
                  </div>
                )}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-100">
                  <Clock className="w-4 h-4 text-emerald-500 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-emerald-800">Today&apos;s Collections</p>
                    <p className="text-xs text-emerald-600">{formatCurrency(data.todayCollections)} collected today</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 border border-blue-100">
                  <TrendingUp className="w-4 h-4 text-blue-500 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-blue-800">Active Students</p>
                    <p className="text-xs text-blue-600">{data.activeStudents} of {data.totalStudents} students are active</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No data available</p>
            )}
          </CardContent>
        </Card>

        {/* Overview */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">School Overview</CardTitle>
            <CardDescription>Key statistics at a glance</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : data ? (
              <div className="space-y-3">
                {[
                  { label: 'Active Staff', value: `${data.activeStaff} / ${data.totalStaff}` },
                  { label: 'Total Classes', value: String(data.totalClasses) },
                  { label: 'Total Fee Collected', value: formatCurrency(data.totalFeePayments) },
                  { label: 'Current Year', value: data.currentAcademicYear?.name || 'Not set' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <span className="text-sm text-gray-600">{item.label}</span>
                    <span className="text-sm font-medium text-gray-900">{item.value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No data available</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
