'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { GraduationCap, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/auth/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        toast.error(data.error?.message || 'Login failed. Please try again.');
        return;
      }

      toast.success(`Welcome back, ${data.data.name}!`);
      router.push('/admin/dashboard');
    } catch {
      toast.error('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-emerald-700 text-white flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold">SchoolManSys</span>
        </div>

        <div className="space-y-6">
          <h1 className="text-4xl font-bold leading-tight">
            Manage your schools<br />
            with confidence.
          </h1>
          <p className="text-emerald-100 text-lg max-w-md">
            The comprehensive school management platform designed for Kenyan educational institutions. 
            Streamline operations, track performance, and empower your schools.
          </p>
          <div className="flex gap-8 pt-4">
            <div>
              <div className="text-3xl font-bold">100+</div>
              <div className="text-emerald-200 text-sm">Schools Managed</div>
            </div>
            <div>
              <div className="text-3xl font-bold">50K+</div>
              <div className="text-emerald-200 text-sm">Students Tracked</div>
            </div>
            <div>
              <div className="text-3xl font-bold">99.9%</div>
              <div className="text-emerald-200 text-sm">Uptime</div>
            </div>
          </div>
        </div>

        <p className="text-emerald-300 text-sm">
          &copy; {new Date().getFullYear()} SchoolManSys. All rights reserved.
        </p>
      </div>

      {/* Right panel - login form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 bg-background">
        <Card className="w-full max-w-md border-0 shadow-none sm:border sm:shadow-sm">
          <CardHeader className="space-y-1 pb-6">
            <div className="flex items-center gap-2 lg:hidden mb-4">
              <div className="w-9 h-9 bg-emerald-600 rounded-lg flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-emerald-700">SchoolManSys</span>
            </div>
            <CardTitle className="text-2xl font-bold">Super Admin Login</CardTitle>
            <CardDescription>
              Sign in to access the administration dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@schoolmansys.co.ke"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11"
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-11 pr-10"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>

            <div className="mt-8 p-4 bg-muted rounded-lg">
              <p className="text-sm font-medium text-muted-foreground mb-2">Demo Credentials</p>
              <div className="space-y-1 text-sm">
                <p><span className="text-muted-foreground">Email:</span> <code className="bg-background px-1.5 py-0.5 rounded text-xs font-mono">admin@schoolmansys.co.ke</code></p>
                <p><span className="text-muted-foreground">Password:</span> <code className="bg-background px-1.5 py-0.5 rounded text-xs font-mono">admin123</code></p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
