'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { GraduationCap, Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SchoolLoginPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params.tenantId as string;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/auth/school/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, tenantId }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Welcome back!', { description: `Signed in as ${data.data.name}` });
        router.push(`/school/${tenantId}/dashboard`);
      } else {
        toast.error('Login failed', { description: data.error?.message || 'Invalid credentials' });
      }
    } catch {
      toast.error('Network error', { description: 'Please check your connection and try again' });
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = () => {
    setEmail('admin@greenfield.co.ke');
    setPassword('school123');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-4">
      <div className="w-full max-w-md">
        {/* School branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-600 text-white mb-4 shadow-lg shadow-emerald-200">
            <GraduationCap className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">SchoolManSys</h1>
          <p className="text-sm text-gray-500 mt-1">
            {tenantId === 'tenant_greenfield' ? 'Greenfield Academy' : `School Portal`}
          </p>
        </div>

        <Card className="border-0 shadow-xl shadow-gray-200/50">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl">Sign in to your school</CardTitle>
            <CardDescription>
              Enter your credentials to access the school portal
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@school.co.ke"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11"
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
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white"
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

              {/* Demo credentials */}
              <div className="mt-4 p-3 rounded-lg bg-gray-50 border border-gray-100">
                <p className="text-xs font-medium text-gray-500 mb-2">Demo Credentials</p>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="font-mono bg-white px-2 py-1 rounded border">admin@greenfield.co.ke</span>
                  <span>/</span>
                  <span className="font-mono bg-white px-2 py-1 rounded border">school123</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleDemoLogin}
                  className="mt-2 w-full text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 text-xs h-8"
                >
                  Fill demo credentials
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-gray-400 mt-6">
          &copy; {new Date().getFullYear()} SchoolManSys. School Management System.
        </p>
      </div>
    </div>
  );
}
