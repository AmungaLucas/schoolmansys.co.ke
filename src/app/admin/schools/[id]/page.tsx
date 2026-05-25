'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  ArrowLeft,
  CheckCircle2,
  Ban,
  Archive,
  School,
  User,
  Calendar,
  Users,
  CreditCard,
  Globe,
  Clock,
  Loader2,
  Mail,
  Copy,
  Check,
  ExternalLink,
  Pencil,
  Trash2,
  Wifi,
  WifiOff,
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  Smartphone,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface SchoolDetail {
  id: string;
  name: string;
  subdomain: string;
  timezone: string;
  status: string;
  planId: string | null;
  planStartDate: string | null;
  expiryDate: string | null;
  createdAt: string;
  updatedAt: string;
  mpesaStkEnabled: boolean;
  hasMpesaConfig: boolean;
  mpesaEnvironment: string | null;
  plan: {
    id: string;
    name: string;
    price: number;
    durationDays: number;
    maxStudents: number;
    maxStaff: number;
    features: string;
  } | null;
  payments: Array<{
    id: string;
    gateway: string;
    checkoutRef: string;
    transactionRef: string | null;
    amount: number;
    status: string;
    paidAt: string | null;
    createdAt: string;
  }>;
  users: Array<{
    id: string;
    email: string;
    name: string;
    status: string;
    role: { name: string } | null;
  }>;
  _count: {
    students: number;
    staff: number;
    classes: number;
    academicYears: number;
    users: number;
  };
}

const statusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default',
  suspended: 'destructive',
  expired: 'secondary',
  provisioning: 'outline',
  provisioning_failed: 'destructive',
  archived: 'secondary',
};

const statusLabel: Record<string, string> = {
  active: 'Active',
  suspended: 'Suspended',
  expired: 'Expired',
  provisioning: 'Provisioning',
  provisioning_failed: 'Failed',
  archived: 'Archived',
};

export default function SchoolDetailPage() {
  const params = useParams();
  const router = useRouter();
  const schoolId = params.id as string;

  const [school, setSchool] = useState<SchoolDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Action dialog
  const [confirmAction, setConfirmAction] = useState<{
    action: string;
    label: string;
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Edit email dialog
  const [editEmailOpen, setEditEmailOpen] = useState(false);
  const [editEmailValue, setEditEmailValue] = useState('');
  const [editEmailLoading, setEditEmailLoading] = useState(false);

  // M-Pesa config state
  const [mpesaConfig, setMpesaConfig] = useState<{
    config: {
      id: string;
      consumerKey: string;
      consumerSecretMasked: string;
      passkeyMasked: string;
      shortcode: string;
      tillNumber: string | null;
      environment: string;
      isActive: boolean;
      lastTestedAt: string | null;
      lastTestResult: string | null;
      configuredAt: string;
      updatedAt: string;
    } | null;
    mpesaStkEnabled: boolean;
    maskedSecrets: boolean;
  } | null>(null);
  const [mpesaLoading, setMpesaLoading] = useState(false);
  const [mpesaSaving, setMpesaSaving] = useState(false);
  const [mpesaTesting, setMpesaTesting] = useState(false);
  const [mpesaDeleting, setMpesaDeleting] = useState(false);
  const [mpesaToggling, setMpesaToggling] = useState(false);
  const [mpesaForm, setMpesaForm] = useState({
    consumerKey: '',
    consumerSecret: '',
    passkey: '',
    shortcode: '',
    tillNumber: '',
    environment: 'sandbox',
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [testResult, setTestResult] = useState<{
    status: 'success' | 'failed' | 'error';
    message: string;
    timestamp: string;
  } | null>(null);

  // Resend invite
  const [resendLoading, setResendLoading] = useState(false);
  const [resendResult, setResendResult] = useState<{
    email: string;
    adminName: string;
    inviteToken: string;
    inviteLink: string;
  } | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);

  const fetchSchool = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/schools/${schoolId}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message || 'Failed to load school');
        return;
      }
      setSchool(json.data);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchool();
  }, [schoolId]);

  // Fetch M-Pesa config
  const fetchMpesaConfig = async () => {
    setMpesaLoading(true);
    try {
      const res = await fetch(`/api/admin/schools/${schoolId}/mpesa-config`);
      const json = await res.json();
      if (json.success) {
        setMpesaConfig(json.data);
        if (json.data.config) {
          const cfg = json.data.config;
          setMpesaForm({
            consumerKey: cfg.consumerKey.slice(0, 6) + '...',
            consumerSecret: '',
            passkey: '',
            shortcode: cfg.shortcode,
            tillNumber: cfg.tillNumber || '',
            environment: cfg.environment,
          });
          // Set test result from config if available
          if (cfg.lastTestResult) {
            setTestResult({
              status: cfg.lastTestResult === 'success' ? 'success' : 'failed',
              message: cfg.lastTestResult === 'success' ? 'Connection successful' : cfg.lastTestResult,
              timestamp: cfg.lastTestedAt || new Date().toISOString(),
            });
          }
        }
      }
    } catch {
      // silent
    } finally {
      setMpesaLoading(false);
    }
  };

  const handleToggleMpesa = async (enabled: boolean) => {
    setMpesaToggling(true);
    try {
      const res = await fetch(`/api/admin/schools/${schoolId}/mpesa-config/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message || 'Failed to toggle M-Pesa');
        return;
      }
      toast.success(enabled ? 'M-Pesa STK Push enabled' : 'M-Pesa STK Push disabled');
      fetchSchool();
      fetchMpesaConfig();
    } catch {
      toast.error('Network error');
    } finally {
      setMpesaToggling(false);
    }
  };

  const handleTestConnection = async () => {
    setMpesaTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/admin/schools/${schoolId}/mpesa-config/test`, {
        method: 'POST',
      });
      const json = await res.json();
      if (json.success) {
        setTestResult({
          status: 'success',
          message: 'Connection successful',
          timestamp: new Date().toISOString(),
        });
        toast.success('M-Pesa connection test passed');
      } else {
        setTestResult({
          status: 'failed',
          message: json.error?.message || 'Authentication error',
          timestamp: new Date().toISOString(),
        });
        toast.error('M-Pesa connection test failed', {
          description: json.error?.message,
        });
      }
    } catch {
      setTestResult({
        status: 'error',
        message: 'Network error — could not reach the server',
        timestamp: new Date().toISOString(),
      });
      toast.error('Connection test failed', { description: 'Network error' });
    } finally {
      setMpesaTesting(false);
    }
  };

  const handleSaveCredentials = async () => {
    const { consumerKey, consumerSecret, passkey, shortcode, tillNumber, environment } = mpesaForm;
    // When editing existing config, consumerKey has '...' suffix — check if user edited it
    if (!consumerKey || consumerKey.endsWith('...')) {
      toast.error('Consumer Key is required — please enter the full value');
      return;
    }
    if (!consumerSecret) {
      toast.error('Consumer Secret is required — must be re-entered for updates');
      return;
    }
    if (!passkey) {
      toast.error('Passkey is required — must be re-entered for updates');
      return;
    }
    if (!shortcode) {
      toast.error('Shortcode is required');
      return;
    }

    setMpesaSaving(true);
    try {
      const res = await fetch(`/api/admin/schools/${schoolId}/mpesa-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consumerKey,
          consumerSecret,
          passkey,
          shortcode,
          tillNumber: tillNumber || undefined,
          environment,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message || 'Failed to save credentials');
        return;
      }
      toast.success('M-Pesa credentials saved successfully');
      fetchSchool();
      fetchMpesaConfig();
    } catch {
      toast.error('Network error');
    } finally {
      setMpesaSaving(false);
    }
  };

  const handleDeleteConfig = async () => {
    setMpesaDeleting(true);
    try {
      const res = await fetch(`/api/admin/schools/${schoolId}/mpesa-config`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message || 'Failed to delete configuration');
        return;
      }
      toast.success('M-Pesa configuration deleted');
      setMpesaConfig(null);
      setMpesaForm({ consumerKey: '', consumerSecret: '', passkey: '', shortcode: '', tillNumber: '', environment: 'sandbox' });
      setTestResult(null);
      setShowDeleteConfirm(false);
      fetchSchool();
    } catch {
      toast.error('Network error');
    } finally {
      setMpesaDeleting(false);
    }
  };

  const handleAction = async () => {
    if (!confirmAction) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/schools/${schoolId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: confirmAction.action }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message || 'Action failed');
        return;
      }
      toast.success(`School ${confirmAction.label.toLowerCase()} successfully`);
      setConfirmAction(null);
      fetchSchool();
    } catch {
      toast.error('Network error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/admin/schools/${schoolId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message || 'Failed to delete school');
        return;
      }
      toast.success(`"${school?.name}" has been permanently deleted`);
      setDeleteConfirm(false);
      router.push('/admin/schools');
    } catch {
      toast.error('Network error');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleEditEmail = async () => {
    if (!editEmailValue.trim()) {
      toast.error('Email is required');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editEmailValue.trim())) {
      toast.error('Please enter a valid email address');
      return;
    }
    setEditEmailLoading(true);
    try {
      const res = await fetch(`/api/admin/schools/${schoolId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminEmail: editEmailValue.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message || 'Failed to update email');
        return;
      }
      toast.success('Admin email updated successfully');
      setEditEmailOpen(false);
      fetchSchool();
    } catch {
      toast.error('Network error');
    } finally {
      setEditEmailLoading(false);
    }
  };

  const handleResendInvite = async () => {
    setResendLoading(true);
    try {
      const res = await fetch(`/api/admin/schools/${schoolId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message || 'Failed to resend invite');
        return;
      }
      setResendResult(json.data);
      if (json.warnings && json.warnings.length > 0) {
        toast.warning('Invite regenerated but email failed to send. Copy the link manually.', {
          description: json.warnings.join(', '),
          duration: 8000,
        });
      } else {
        toast.success('New invite sent to ' + json.data.email);
      }
      fetchSchool();
    } catch {
      toast.error('Network error');
    } finally {
      setResendLoading(false);
    }
  };

  const copyToClipboard = async (text: string, type: 'link' | 'token') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'link') {
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
      } else {
        setTokenCopied(true);
        setTimeout(() => setTokenCopied(false), 2000);
      }
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Check if admin user is still in "invited" status
  const adminUser = school?.users[0];
  const isAdminInvited = adminUser?.status === 'invited';

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (error || !school) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" asChild>
          <Link href="/admin/schools">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Schools
          </Link>
        </Button>
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-destructive font-medium">{error || 'School not found'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const paymentStatusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    completed: 'default',
    success: 'default',
    pending: 'secondary',
    failed: 'destructive',
    cancelled: 'outline',
  };

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Button variant="ghost" size="sm" asChild>
        <Link href="/admin/schools">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Schools
        </Link>
      </Button>

      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <School className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{school.name}</h1>
            <p className="text-muted-foreground flex items-center gap-2 mt-1">
              <code className="text-xs bg-muted px-2 py-0.5 rounded">{school.subdomain}</code>
              <Badge variant={statusVariant[school.status] || 'outline'}>
                {statusLabel[school.status] || school.status}
              </Badge>
              {isAdminInvited && (
                <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">
                  Invite Pending
                </Badge>
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {isAdminInvited && (
            <Button
              size="sm"
              className="bg-amber-500 hover:bg-amber-600 text-white"
              onClick={handleResendInvite}
              disabled={resendLoading}
            >
              {resendLoading ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Mail className="w-4 h-4 mr-1" />
              )}
              Resend Invite
            </Button>
          )}
          {school.status !== 'active' && (
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => setConfirmAction({ action: 'active', label: 'Activate' })}
            >
              <CheckCircle2 className="w-4 h-4 mr-1" />
              Activate
            </Button>
          )}
          {school.status !== 'suspended' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmAction({ action: 'suspended', label: 'Suspend' })}
            >
              <Ban className="w-4 h-4 mr-1" />
              Suspend
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setConfirmAction({ action: 'archived', label: 'Archive' })}
          >
            <Archive className="w-4 h-4 mr-1" />
            Archive
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setDeleteConfirm(true)}
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Delete
          </Button>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Plan</p>
              <p className="text-sm font-medium">{school.plan?.name || 'No plan assigned'}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Expiry Date</p>
              <p className="text-sm font-medium">{formatDate(school.expiryDate)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Students</p>
              <p className="text-sm font-medium">{school._count.students}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
              <Globe className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Timezone</p>
              <p className="text-sm font-medium">{school.timezone}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs: Overview, Payments, M-Pesa */}
      <Tabs defaultValue="overview" className="space-y-6" onValueChange={(value) => {
        if (value === 'mpesa' && !mpesaConfig && !mpesaLoading) {
          fetchMpesaConfig();
        }
      }}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="payments">Payments ({school.payments.length})</TabsTrigger>
          <TabsTrigger value="mpesa" className="gap-1.5"><Smartphone className="w-3.5 h-3.5" /> M-Pesa</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* School Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <School className="w-4 h-4" />
                  School Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">School Name</p>
                    <p className="font-medium">{school.name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Subdomain</p>
                    <p className="font-mono text-xs">{school.subdomain}.schoolmansys.co.ke</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <Badge variant={statusVariant[school.status]}>{statusLabel[school.status] || school.status}</Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Plan Start</p>
                    <p className="font-medium">{formatDate(school.planStartDate)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Expiry Date</p>
                    <p className="font-medium">{formatDate(school.expiryDate)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Timezone</p>
                    <p className="font-medium">{school.timezone}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Created</p>
                    <p className="font-medium">{formatDate(school.createdAt)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Admin Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Admin Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                {school.users.length > 0 ? (
                  <div className="space-y-4">
                    {school.users.map((user) => (
                      <div key={user.id} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                        <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-emerald-700 font-semibold">
                            {user.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{user.name}</p>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                            <button
                              onClick={() => { setEditEmailOpen(true); setEditEmailValue(user.email); }}
                              className="text-muted-foreground hover:text-emerald-600 transition-colors"
                              title="Edit email"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Role: {user.role?.name || 'Admin'}
                          </p>
                          <div className="mt-1">
                            {user.status === 'invited' ? (
                              <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">
                                Invite Pending
                              </Badge>
                            ) : user.status === 'active' ? (
                              <Badge variant="outline" className="border-emerald-300 text-emerald-700 bg-emerald-50">
                                Active
                              </Badge>
                            ) : (
                              <Badge variant="outline">{user.status}</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No admin users found
                  </p>
                )}

                <Separator className="my-4" />

                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-2xl font-bold">{school._count.students}</p>
                    <p className="text-xs text-muted-foreground">Students</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{school._count.staff}</p>
                    <p className="text-xs text-muted-foreground">Staff</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{school._count.classes}</p>
                    <p className="text-xs text-muted-foreground">Classes</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Plan details */}
          {school.plan && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  Current Plan
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Plan Name</p>
                    <p className="font-medium text-sm">{school.plan.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Price</p>
                    <p className="font-medium text-sm">{formatCurrency(school.plan.price)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Duration</p>
                    <p className="font-medium text-sm">{school.plan.durationDays} days</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Max Students</p>
                    <p className="font-medium text-sm">{school.plan.maxStudents}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Max Staff</p>
                    <p className="font-medium text-sm">{school.plan.maxStaff}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payment History</CardTitle>
              <CardDescription>All payments associated with this school</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {school.payments.length === 0 ? (
                <div className="text-center py-12">
                  <CreditCard className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No payment records found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Reference</TableHead>
                        <TableHead>Gateway</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Paid At</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {school.payments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell className="font-mono text-xs">
                            {payment.transactionRef || payment.checkoutRef.slice(0, 12) + '...'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="uppercase text-xs">
                              {payment.gateway}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency(payment.amount)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={paymentStatusVariant[payment.status] || 'outline'}>
                              {payment.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(payment.paidAt)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(payment.createdAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* M-Pesa Configuration Tab */}
        <TabsContent value="mpesa" className="space-y-6">
          {/* Toggle Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <Smartphone className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-base">M-Pesa STK Push</CardTitle>
                  <CardDescription>
                    Enable M-Pesa payment collection for this school. Parents will receive STK Push prompts
                    on their phones when school staff initiate fee payments.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                {/* Custom Toggle Buttons */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleToggleMpesa(true)}
                    disabled={mpesaToggling || (mpesaConfig?.mpesaStkEnabled ?? school.mpesaStkEnabled)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-l-lg border-r-0 border text-sm font-medium transition-colors ${
                      (mpesaConfig?.mpesaStkEnabled ?? school.mpesaStkEnabled)
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-emerald-50'
                    } ${mpesaToggling ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    {mpesaToggling ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Wifi className="w-4 h-4" />
                    )}
                    Enabled
                  </button>
                  <button
                    onClick={() => handleToggleMpesa(false)}
                    disabled={mpesaToggling || !(mpesaConfig?.mpesaStkEnabled ?? school.mpesaStkEnabled)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-r-lg border text-sm font-medium transition-colors ${
                      !(mpesaConfig?.mpesaStkEnabled ?? school.mpesaStkEnabled)
                        ? 'bg-gray-100 text-gray-900 border-gray-300'
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    } ${mpesaToggling ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    {mpesaToggling ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <WifiOff className="w-4 h-4" />
                    )}
                    Disabled
                  </button>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    fetchMpesaConfig().then(() => handleTestConnection());
                  }}
                  disabled={mpesaTesting || mpesaLoading}
                >
                  {mpesaTesting ? (
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-1.5" />
                  )}
                  Test Connection
                </Button>
              </div>

              {/* Status indicator */}
              {(mpesaConfig?.config || mpesaConfig?.mpesaStkEnabled || school.hasMpesaConfig) ? (
                <div className="flex items-center gap-2 text-sm">
                  {(mpesaConfig?.mpesaStkEnabled ?? school.mpesaStkEnabled) ? (
                    <>
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span className="text-emerald-700 font-medium">Connected</span>
                      <span className="text-muted-foreground">
                        ({mpesaConfig?.config?.environment || school.mpesaEnvironment || 'sandbox'})
                      </span>
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="w-4 h-4 text-amber-500" />
                      <span className="text-amber-700 font-medium">Disabled</span>
                      <span className="text-muted-foreground">Configuration exists but STK Push is off</span>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm">
                  <ShieldAlert className="w-4 h-4 text-gray-400" />
                  <span className="text-muted-foreground">Not configured</span>
                  <span className="text-muted-foreground">· No credentials set</span>
                </div>
              )}

              {/* Test result */}
              {testResult && (
                <div
                  className={`rounded-lg border p-3 flex items-start gap-2 ${
                    testResult.status === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : 'bg-red-50 border-red-200 text-red-700'
                  }`}
                >
                  {testResult.status === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  )}
                  <div className="text-sm">
                    <span className="font-medium">
                      {testResult.status === 'success' ? 'Connected' : 'Test failed'}
                    </span>
                    <span className="text-muted-foreground"> · {testResult.message}</span>
                    <span className="block text-xs text-muted-foreground mt-0.5">
                      Last tested {testResult.timestamp ? new Date(testResult.timestamp).toLocaleString('en-KE') : 'just now'}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Production Warning Banner */}
          {(mpesaConfig?.config?.environment || mpesaForm.environment) === 'production' && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">Production Environment Active</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Real M-Pesa transactions will be processed. Ensure all credentials are correct and have been tested in Sandbox first.
                </p>
              </div>
            </div>
          )}

          {/* Credentials Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <KeyRound className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-base">Daraja API Credentials</CardTitle>
                  <CardDescription>
                    {mpesaConfig?.config
                      ? 'Update M-Pesa credentials for this school. Secrets must be re-entered to update.'
                      : 'Configure M-Pesa Daraja API credentials for this school.'}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {mpesaLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="mpesa-consumer-key">Consumer Key</Label>
                      <Input
                        id="mpesa-consumer-key"
                        value={mpesaForm.consumerKey}
                        onChange={(e) => setMpesaForm({ ...mpesaForm, consumerKey: e.target.value })}
                        placeholder="e.g., cl_xxxxxxxxxxxxxxxx"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mpesa-consumer-secret">
                        Consumer Secret
                        {mpesaConfig?.config && (
                          <span className="text-xs text-muted-foreground ml-1">(re-enter to update)</span>
                        )}
                      </Label>
                      <Input
                        id="mpesa-consumer-secret"
                        type="password"
                        value={mpesaConfig?.config ? (mpesaForm.consumerSecret || '****') : mpesaForm.consumerSecret}
                        onChange={(e) => setMpesaForm({ ...mpesaForm, consumerSecret: e.target.value })}
                        placeholder={mpesaConfig?.config ? '****' : 'Enter consumer secret'}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mpesa-passkey">
                        Passkey
                        {mpesaConfig?.config && (
                          <span className="text-xs text-muted-foreground ml-1">(re-enter to update)</span>
                        )}
                      </Label>
                      <Input
                        id="mpesa-passkey"
                        type="password"
                        value={mpesaConfig?.config ? (mpesaForm.passkey || '****') : mpesaForm.passkey}
                        onChange={(e) => setMpesaForm({ ...mpesaForm, passkey: e.target.value })}
                        placeholder={mpesaConfig?.config ? '****' : 'Enter passkey'}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mpesa-shortcode">Shortcode / Till</Label>
                      <Input
                        id="mpesa-shortcode"
                        value={mpesaForm.shortcode}
                        onChange={(e) => setMpesaForm({ ...mpesaForm, shortcode: e.target.value })}
                        placeholder="e.g., 174379"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mpesa-till">Till Number (optional)</Label>
                      <Input
                        id="mpesa-till"
                        value={mpesaForm.tillNumber}
                        onChange={(e) => setMpesaForm({ ...mpesaForm, tillNumber: e.target.value })}
                        placeholder="Enter till number if using Paybill"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mpesa-environment">Environment</Label>
                      <div className="flex items-center gap-3 mt-1">
                        <button
                          onClick={() => setMpesaForm({ ...mpesaForm, environment: 'sandbox' })}
                          className={`flex items-center gap-2 px-4 py-2 rounded-l-lg border-r-0 border text-sm font-medium transition-colors ${
                            mpesaForm.environment === 'sandbox'
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                          } cursor-pointer`}
                        >
                          Sandbox
                        </button>
                        <button
                          onClick={() => setMpesaForm({ ...mpesaForm, environment: 'production' })}
                          className={`flex items-center gap-2 px-4 py-2 rounded-r-lg border text-sm font-medium transition-colors ${
                            mpesaForm.environment === 'production'
                              ? 'bg-amber-600 text-white border-amber-600'
                              : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                          } cursor-pointer`}
                        >
                          Production
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Sandbox warning */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-700">
                      Always test with Sandbox before going to Production. Use Safaricom&apos;s Daraja sandbox
                      credentials to verify your integration.
                    </p>
                  </div>

                  <Separator />

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <Button
                      className="bg-emerald-600 hover:bg-emerald-700"
                      onClick={handleSaveCredentials}
                      disabled={mpesaSaving}
                    >
                      {mpesaSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <KeyRound className="w-4 h-4 mr-2" />
                          {mpesaConfig?.config ? 'Update Credentials' : 'Save Credentials'}
                        </>
                      )}
                    </Button>

                    {mpesaConfig?.config && (
                      showDeleteConfirm ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-destructive">Are you sure?</span>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleDeleteConfig}
                            disabled={mpesaDeleting}
                          >
                            {mpesaDeleting ? (
                              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5 mr-1" />
                            )}
                            Confirm Delete
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowDeleteConfirm(false)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-red-50"
                          onClick={() => setShowDeleteConfirm(true)}
                        >
                          <Trash2 className="w-4 h-4 mr-1.5" />
                          Delete Configuration
                        </Button>
                      )
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action confirmation dialog (status change) */}
      <Dialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm {confirmAction?.label}</DialogTitle>
            <DialogDescription>
              Are you sure you want to {confirmAction?.label.toLowerCase()}{' '}
              <strong>{school.name}</strong>? This action can be reversed by changing the status later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>
              Cancel
            </Button>
            <Button
              variant={confirmAction?.action === 'active' ? 'default' : 'destructive'}
              className={confirmAction?.action === 'active' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
              onClick={handleAction}
              disabled={actionLoading}
            >
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {confirmAction?.label}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              Delete School Permanently
            </DialogTitle>
            <DialogDescription>
              This will permanently delete <strong>{school.name}</strong> and ALL associated data including
              students, staff, classes, attendance records, fee payments, assessments, and more.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {school._count.students > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-800">
              <strong>Warning:</strong> This school has {school._count.students} student(s), {school._count.staff} staff member(s),
              and {school._count.classes} class(es). All data will be permanently lost.
            </div>
          )}
          <div className="flex items-center gap-2 py-1">
            <Label className="text-sm font-medium">Type the school name to confirm:</Label>
            <code className="text-sm bg-muted px-2 py-0.5 rounded font-mono">{school.name}</code>
          </div>
          <Input
            placeholder={`Type "${school.name}" to confirm`}
            id="delete-confirm-input"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteLoading}
            >
              {deleteLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Email dialog */}
      <Dialog open={editEmailOpen} onOpenChange={setEditEmailOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-4 h-4" />
              Edit Admin Email
            </DialogTitle>
            <DialogDescription>
              Update the admin email address for <strong>{school.name}</strong>.
              The invite link will remain valid for the old email until a new invite is sent.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-email">New Email Address</Label>
              <Input
                id="edit-email"
                type="email"
                value={editEmailValue}
                onChange={(e) => setEditEmailValue(e.target.value)}
                placeholder="admin@school.co.ke"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEmailOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleEditEmail}
              disabled={editEmailLoading || !editEmailValue.trim()}
            >
              {editEmailLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Email'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resend Invite Result Dialog */}
      <Dialog open={!!resendResult} onOpenChange={(open) => { if (!open) setResendResult(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Invite Regenerated
            </DialogTitle>
            <DialogDescription>
              A new invite has been generated for <strong>{resendResult?.adminName}</strong> ({resendResult?.email}).
              Their previous password has been cleared — they must set a new one.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Invite Link</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-muted p-3 rounded-md break-all select-all leading-relaxed">
                  {resendResult?.inviteLink}
                </code>
                <Button
                  size="icon"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => copyToClipboard(resendResult?.inviteLink || '', 'link')}
                >
                  {linkCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Invite Token</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-muted p-3 rounded-md font-mono select-all">
                  {resendResult?.inviteToken}
                </code>
                <Button
                  size="icon"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => copyToClipboard(resendResult?.inviteToken || '', 'token')}
                >
                  {tokenCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              This link expires in 7 days. You can resend it again at any time.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResendResult(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
