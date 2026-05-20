'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Plus,
  Search,
  Eye,
  Ban,
  CheckCircle2,
  Archive,
  MoreHorizontal,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

interface Plan {
  id: string;
  name: string;
  price: number;
}

interface School {
  id: string;
  name: string;
  subdomain: string;
  status: string;
  planId: string | null;
  expiryDate: string | null;
  createdAt: string;
  plan: Plan | null;
  _count: {
    students: number;
    staff: number;
    users: number;
  };
}

interface CreateSchoolForm {
  name: string;
  subdomain: string;
  adminName: string;
  adminEmail: string;
  planId: string;
}

interface CreatedSchoolResult {
  id: string;
  name: string;
  subdomain: string;
  status: string;
  adminEmail: string;
  inviteToken: string;
  inviteLink: string;
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

export default function SchoolsPage() {
  const router = useRouter();
  const [schools, setSchools] = useState<School[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // Create school dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateSchoolForm>({
    name: '',
    subdomain: '',
    adminName: '',
    adminEmail: '',
    planId: '',
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [checkingSubdomain, setCheckingSubdomain] = useState(false);
  const [subdomainAvailable, setSubdomainAvailable] = useState<boolean | null>(null);

  // Invite link dialog (shown after creation)
  const [createdSchool, setCreatedSchool] = useState<CreatedSchoolResult | null>(null);
  const [inviteLinkCopied, setInviteLinkCopied] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);

  // Action confirmations
  const [confirmAction, setConfirmAction] = useState<{
    schoolId: string;
    schoolName: string;
    action: string;
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchPlans = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/plans');
      const json = await res.json();
      if (json.success) setPlans(json.data || []);
    } catch {
      // Ignore — plan selection is optional
    }
  }, []);

  const fetchSchools = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', '10');
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(`/api/admin/schools?${params}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message || 'Failed to load schools');
        return;
      }
      setSchools(json.data.schools);
      setTotalPages(json.data.pagination.totalPages);
    } catch {
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  useEffect(() => {
    fetchSchools();
  }, [fetchSchools]);

  const checkSubdomain = useCallback(async (subdomain: string) => {
    if (!subdomain || subdomain.length < 3) {
      setSubdomainAvailable(null);
      return;
    }
    setCheckingSubdomain(true);
    try {
      const res = await fetch(`/api/admin/schools/check-subdomain?subdomain=${encodeURIComponent(subdomain)}`);
      const json = await res.json();
      if (json.success) {
        setSubdomainAvailable(json.data.available);
      }
    } catch {
      // Ignore errors for subdomain check
    } finally {
      setCheckingSubdomain(false);
    }
  }, []);

  const handleSubdomainChange = (value: string) => {
    const clean = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setCreateForm((prev) => ({ ...prev, subdomain: clean }));
    checkSubdomain(clean);
  };

  const handleCreateSchool = async () => {
    if (!createForm.name || !createForm.subdomain || !createForm.adminName || !createForm.adminEmail) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(createForm.subdomain) || createForm.subdomain.length < 3) {
      toast.error('Subdomain must be at least 3 characters, lowercase, and contain only letters, numbers, and hyphens');
      return;
    }

    setCreateLoading(true);
    try {
      const res = await fetch('/api/admin/schools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createForm.name,
          subdomain: createForm.subdomain,
          adminName: createForm.adminName,
          adminEmail: createForm.adminEmail,
          planId: createForm.planId || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message || 'Failed to create school');
        return;
      }

      // Close create dialog and show invite link dialog
      setCreateOpen(false);
      setCreatedSchool(json.data);

      if (json.warnings && json.warnings.length > 0) {
        toast.warning('School created but email failed. Share the invite link manually.', {
          description: json.warnings.join(', '),
          duration: 8000,
        });
      } else {
        toast.success(`School "${createForm.name}" created successfully!`);
      }

      // Reset form
      setCreateForm({ name: '', subdomain: '', adminName: '', adminEmail: '', planId: '' });
      setSubdomainAvailable(null);
      fetchSchools();
    } catch {
      toast.error('Network error');
    } finally {
      setCreateLoading(false);
    }
  };

  const copyToClipboard = async (text: string, type: 'link' | 'token') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'link') {
        setInviteLinkCopied(true);
        setTimeout(() => setInviteLinkCopied(false), 2000);
      } else {
        setTokenCopied(true);
        setTimeout(() => setTokenCopied(false), 2000);
      }
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleSchoolAction = async () => {
    if (!confirmAction) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/schools/${confirmAction.schoolId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: confirmAction.action }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message || 'Action failed');
        return;
      }
      toast.success(`School ${confirmAction.action === 'active' ? 'activated' : confirmAction.action} successfully`);
      setConfirmAction(null);
      fetchSchools();
    } catch {
      toast.error('Network error');
    } finally {
      setActionLoading(false);
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

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Schools</h1>
          <p className="text-muted-foreground">Manage school tenants and their status</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="w-4 h-4 mr-2" />
              Create School
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create New School</DialogTitle>
              <DialogDescription>
                Set up a new school tenant. An invite link will be generated for the admin to set their password.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="school-name">School Name *</Label>
                <Input
                  id="school-name"
                  placeholder="e.g., Sunshine Academy"
                  value={createForm.name}
                  onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="subdomain">
                  Subdomain *
                  {checkingSubdomain && <Loader2 className="inline w-3 h-3 ml-2 animate-spin" />}
                  {subdomainAvailable === true && (
                    <span className="text-emerald-600 text-xs ml-2">Available</span>
                  )}
                  {subdomainAvailable === false && (
                    <span className="text-red-600 text-xs ml-2">Taken</span>
                  )}
                </Label>
                <div className="flex items-center">
                  <Input
                    id="subdomain"
                    placeholder="sunshine-academy"
                    value={createForm.subdomain}
                    onChange={(e) => handleSubdomainChange(e.target.value)}
                    className="rounded-r-none"
                  />
                  <div className="px-3 py-2 bg-muted border border-l-0 border-input rounded-r-md text-sm text-muted-foreground whitespace-nowrap">
                    .schoolmansys.co.ke
                  </div>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="plan">Subscription Plan</Label>
                <Select
                  value={createForm.planId}
                  onValueChange={(v) => setCreateForm((p) => ({ ...p, planId: v === '__none__' ? '' : v }))}
                >
                  <SelectTrigger id="plan">
                    <SelectValue placeholder="Select a plan (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No plan (30-day trial)</SelectItem>
                    {plans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name} — KES {plan.price.toLocaleString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="admin-name">Admin Full Name *</Label>
                <Input
                  id="admin-name"
                  placeholder="John Doe"
                  value={createForm.adminName}
                  onChange={(e) => setCreateForm((p) => ({ ...p, adminName: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="admin-email">Admin Email *</Label>
                <Input
                  id="admin-email"
                  type="email"
                  placeholder="admin@sunshine.ac.ke"
                  value={createForm.adminEmail}
                  onChange={(e) => setCreateForm((p) => ({ ...p, adminEmail: e.target.value }))}
                />
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-800">
                An invite link will be generated after creation. The admin will use this link to set their password (requires uppercase, lowercase, digit, 8+ characters).
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={handleCreateSchool}
                disabled={createLoading}
              >
                {createLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create School'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Invite Link Dialog (shown after creation) */}
      <Dialog open={!!createdSchool} onOpenChange={(open) => { if (!open) setCreatedSchool(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              School Created Successfully
            </DialogTitle>
            <DialogDescription>
              Share the invite link below with <strong>{createdSchool?.adminEmail}</strong> so they can set their password and access the portal.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Invite Link */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Invite Link (share via email/WhatsApp)</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-muted p-3 rounded-md break-all select-all leading-relaxed">
                  {createdSchool?.inviteLink}
                </code>
                <Button
                  size="icon"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => copyToClipboard(createdSchool?.inviteLink || '', 'link')}
                >
                  {inviteLinkCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {/* Invite Token */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Invite Token (for manual use)</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-muted p-3 rounded-md font-mono select-all">
                  {createdSchool?.inviteToken}
                </code>
                <Button
                  size="icon"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => copyToClipboard(createdSchool?.inviteToken || '', 'token')}
                >
                  {tokenCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {/* School details summary */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-md p-3 text-sm space-y-1">
              <p><strong>School:</strong> {createdSchool?.name}</p>
              <p><strong>Subdomain:</strong> {createdSchool?.subdomain}.schoolmansys.co.ke</p>
              <p><strong>Status:</strong> <Badge variant={statusVariant[createdSchool?.status || ''] || 'outline'}>{statusLabel[createdSchool?.status || ''] || createdSchool?.status}</Badge></p>
            </div>

            <p className="text-xs text-muted-foreground">
              This link expires in 7 days. You can resend it from the school detail page.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreatedSchool(null)}>
              Close
            </Button>
            <Button
              variant="outline"
              asChild
            >
              <Link href={`/admin/schools/${createdSchool?.id}`}>
                <ExternalLink className="w-4 h-4 mr-1" />
                View School Details
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search schools by name or subdomain..."
                className="pl-9"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === 'all' ? '' : v); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="provisioning">Provisioning</SelectItem>
                <SelectItem value="provisioning_failed">Failed</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Schools table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : schools.length === 0 ? (
            <div className="text-center py-16">
              <Search className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-lg font-medium">No schools found</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {search || statusFilter
                  ? 'Try adjusting your search or filters.'
                  : 'Get started by creating your first school.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>School Name</TableHead>
                    <TableHead className="hidden md:table-cell">Subdomain</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden sm:table-cell">Plan</TableHead>
                    <TableHead className="hidden lg:table-cell">Expiry</TableHead>
                    <TableHead className="hidden lg:table-cell">Students</TableHead>
                    <TableHead className="w-12">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schools.map((school) => (
                    <TableRow key={school.id}>
                      <TableCell>
                        <Link
                          href={`/admin/schools/${school.id}`}
                          className="font-medium hover:text-emerald-600 transition-colors"
                        >
                          {school.name}
                        </Link>
                        <p className="text-xs text-muted-foreground md:hidden">{school.subdomain}</p>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <code className="text-xs bg-muted px-2 py-1 rounded">{school.subdomain}</code>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[school.status] || 'outline'}>
                          {statusLabel[school.status] || school.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm">
                        {school.plan?.name || (
                          <span className="text-muted-foreground">No plan</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {formatDate(school.expiryDate)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">
                        {school._count.students}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/admin/schools/${school.id}`}>
                                <Eye className="w-4 h-4 mr-2" />
                                View Details
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {school.status !== 'active' && (
                              <DropdownMenuItem
                                onClick={() => setConfirmAction({ schoolId: school.id, schoolName: school.name, action: 'active' })}
                              >
                                <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-600" />
                                Activate
                              </DropdownMenuItem>
                            )}
                            {school.status !== 'suspended' && (
                              <DropdownMenuItem
                                onClick={() => setConfirmAction({ schoolId: school.id, schoolName: school.name, action: 'suspended' })}
                              >
                                <Ban className="w-4 h-4 mr-2 text-amber-600" />
                                Suspend
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => setConfirmAction({ schoolId: school.id, schoolName: school.name, action: 'archived' })}
                            >
                              <Archive className="w-4 h-4 mr-2" />
                              Archive
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDeleteSchool(school)}
                              className="text-red-600 focus:text-red-600"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete Permanently
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {!loading && schools.length > 0 && totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="sr-only">Previous</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  <ChevronRight className="w-4 h-4" />
                  <span className="sr-only">Next</span>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action confirmation dialog */}
      <Dialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Action</DialogTitle>
            <DialogDescription>
              Are you sure you want to {confirmAction?.action === 'active' ? 'activate' : confirmAction?.action}{' '}
              <strong>{confirmAction?.schoolName}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>
              Cancel
            </Button>
            <Button
              variant={confirmAction?.action === 'active' ? 'default' : 'destructive'}
              className={confirmAction?.action === 'active' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
              onClick={handleSchoolAction}
              disabled={actionLoading}
            >
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {confirmAction?.action === 'active' ? 'Activate' : confirmAction?.action === 'suspended' ? 'Suspend' : 'Archive'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
