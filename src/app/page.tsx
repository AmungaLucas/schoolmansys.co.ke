'use client'

import { useSyncExternalStore } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { GraduationCap, Shield, School, Wallet, BookOpen, Users, ArrowRight, CheckCircle2 } from 'lucide-react'

const emptySubscribe = () => () => {}

/**
 * Returns false during SSR and true on the client.
 * Uses useSyncExternalStore to avoid hydration mismatches
 * caused by browser extensions injecting DOM elements.
 */
function useHydrated() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  )
}

export default function Home() {
  const hydrated = useHydrated()

  // Render a minimal shell on the server to avoid hydration mismatches
  // from browser extensions injecting DOM elements
  if (!hydrated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50" />
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">SchoolManSys</h1>
              <p className="text-xs text-gray-500 -mt-0.5">CBC/CBE School Management</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/admin/login">
              <Button variant="outline" size="sm" className="hidden sm:flex">
                <Shield className="w-4 h-4 mr-1.5" />
                Admin Portal
              </Button>
            </Link>
            <Link href="/school/tenant_greenfield/login">
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                <School className="w-4 h-4 mr-1.5" />
                School Portal
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="text-center max-w-3xl mx-auto">
          <Badge variant="secondary" className="mb-4 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
            Built for Kenyan CBC/CBE Curriculum
          </Badge>
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight mb-4">
            Complete School Management
            <span className="text-emerald-600"> Platform</span>
          </h2>
          <p className="text-lg text-gray-600 mb-8 leading-relaxed">
            Multi-tenant SaaS solution for Kenyan schools implementing the Competency-Based
            Curriculum. Manage students, fees, attendance, assessments, and more — all in
            one secure, shared-hosting-optimised platform.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/admin/login">
              <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 w-full sm:w-auto">
                <Shield className="w-5 h-5 mr-2" />
                Super Admin Portal
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link href="/school/tenant_greenfield/login">
              <Button size="lg" variant="outline" className="w-full sm:w-auto border-emerald-200 hover:bg-emerald-50">
                <School className="w-5 h-5 mr-2" />
                School Demo Portal
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="border-emerald-100 hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center mb-2">
                <Users className="w-5 h-5 text-emerald-600" />
              </div>
              <CardTitle className="text-lg">Student Management</CardTitle>
              <CardDescription>Enroll, track, and manage students with UPI validation, guardian linking, and CBC-compliant records.</CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-emerald-100 hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center mb-2">
                <Wallet className="w-5 h-5 text-emerald-600" />
              </div>
              <CardTitle className="text-lg">Fee Management</CardTitle>
              <CardDescription>Flexible fee structures, automated balance tracking, M-Pesa integration, and comprehensive financial reports.</CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-emerald-100 hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center mb-2">
                <BookOpen className="w-5 h-5 text-emerald-600" />
              </div>
              <CardTitle className="text-lg">CBC Academics</CardTitle>
              <CardDescription>Full CBC curriculum support with strands, sub-strands, rubric-based assessments (E/M/A/B), and report cards.</CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-emerald-100 hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center mb-2">
                <GraduationCap className="w-5 h-5 text-emerald-600" />
              </div>
              <CardTitle className="text-lg">Attendance Tracking</CardTitle>
              <CardDescription>Bulk attendance marking, archive management, low-attendance alerts, and detailed attendance reports.</CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-emerald-100 hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center mb-2">
                <School className="w-5 h-5 text-emerald-600" />
              </div>
              <CardTitle className="text-lg">Multi-Tenant SaaS</CardTitle>
              <CardDescription>Complete tenant isolation, subscription plans, M-Pesa payments, and easy onboarding with setup wizards.</CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-emerald-100 hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center mb-2">
                <Shield className="w-5 h-5 text-emerald-600" />
              </div>
              <CardTitle className="text-lg">Secure & Compliant</CardTitle>
              <CardDescription>Pessimistic locking for fees, audit logging, impersonation support, and NEMIS export capability.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* Demo Credentials Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <Card className="bg-emerald-600 text-white">
          <CardHeader>
            <CardTitle className="text-xl text-white">Try the Demo</CardTitle>
            <CardDescription className="text-emerald-100">
              Explore the platform with pre-configured demo data
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-semibold text-emerald-100">Super Admin</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                  <span>Email: <code className="bg-emerald-700 px-2 py-0.5 rounded text-xs">admin@schoolmansys.co.ke</code></span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                  <span>Password: <code className="bg-emerald-700 px-2 py-0.5 rounded text-xs">admin123</code></span>
                </div>
              </div>
              <Link href="/admin/login">
                <Button variant="outline" size="sm" className="border-emerald-300 text-white hover:bg-emerald-700 mt-2">
                  Open Admin Portal <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            </div>
            <div className="space-y-3">
              <h4 className="font-semibold text-emerald-100">School Admin (Greenfield Academy)</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                  <span>Email: <code className="bg-emerald-700 px-2 py-0.5 rounded text-xs">admin@greenfield.co.ke</code></span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                  <span>Password: <code className="bg-emerald-700 px-2 py-0.5 rounded text-xs">school123</code></span>
                </div>
              </div>
              <Link href="/school/tenant_greenfield/login">
                <Button variant="outline" size="sm" className="border-emerald-300 text-white hover:bg-emerald-700 mt-2">
                  Open School Portal <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-emerald-600" />
              <span className="font-medium text-gray-700">SchoolManSys</span>
              <span>v4.0</span>
            </div>
            <div className="flex items-center gap-4">
              <span>Built for Kenyan CBC/CBE</span>
              <span className="hidden sm:inline">|</span>
              <span className="hidden sm:inline">Next.js + Prisma + MySQL</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
