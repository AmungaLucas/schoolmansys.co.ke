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

      {/* Tabs: Overview, Payments */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="payments">Payments ({school.payments.length})</TabsTrigger>
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
                          <p className="font-medium text-sm">{user.name}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
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
      </Tabs>

      {/* Action confirmation dialog */}
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
