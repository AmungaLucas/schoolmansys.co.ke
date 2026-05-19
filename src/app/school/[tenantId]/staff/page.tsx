'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Loader2, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useSchool } from '../layout';

interface StaffMember {
  id: string;
  employeeNumber: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  designation: string | null;
  qualification: string | null;
  dateJoined: string | null;
  status: string;
  createdAt: string;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function StaffPage() {
  const { tenantId } = useSchool();

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Add staff dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    designation: '',
    qualification: '',
    dateJoined: '',
    employeeNumber: '',
  });

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '10' });
      if (search) params.set('search', search);
      const res = await fetch(`/api/school/${tenantId}/staff?${params}`);
      const json = await res.json();
      if (json.success) {
        setStaff(json.data.staff);
        setTotalPages(json.data.pagination.totalPages);
      }
    } catch {
      toast.error('Failed to load staff');
    } finally {
      setLoading(false);
    }
  }, [tenantId, search, page]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const handleAddStaff = async () => {
    if (!form.firstName || !form.lastName) {
      toast.error('First name and last name are required');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/school/${tenantId}/staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email || undefined,
          phone: form.phone || undefined,
          designation: form.designation || undefined,
          qualification: form.qualification || undefined,
          dateJoined: form.dateJoined || undefined,
          employeeNumber: form.employeeNumber || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Staff member added');
        setDialogOpen(false);
        setForm({ firstName: '', lastName: '', email: '', phone: '', designation: '', qualification: '', dateJoined: '', employeeNumber: '' });
        fetchStaff();
      } else {
        toast.error(json.error?.message || 'Failed to add staff');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff</h1>
          <p className="text-sm text-gray-500">Manage school staff and teachers</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
              <Plus className="w-4 h-4" />
              Add Staff
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Staff Member</DialogTitle>
              <DialogDescription>Enter the staff member&apos;s details.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First Name *</Label>
                  <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Last Name *</Label>
                  <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Employee Number</Label>
                  <Input value={form.employeeNumber} onChange={(e) => setForm({ ...form, employeeNumber: e.target.value })} placeholder="EMP-001" />
                </div>
                <div className="space-y-2">
                  <Label>Designation</Label>
                  <Input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} placeholder="Teacher, Admin..." />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Qualification</Label>
                  <Input value={form.qualification} onChange={(e) => setForm({ ...form, qualification: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Date Joined</Label>
                  <Input type="date" value={form.dateJoined} onChange={(e) => setForm({ ...form, dateJoined: e.target.value })} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleAddStaff} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Add Staff
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search by name, email, or employee number..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="text-xs font-semibold">Emp No</TableHead>
                <TableHead className="text-xs font-semibold">Name</TableHead>
                <TableHead className="text-xs font-semibold">Designation</TableHead>
                <TableHead className="text-xs font-semibold">Phone</TableHead>
                <TableHead className="text-xs font-semibold">Status</TableHead>
                <TableHead className="text-xs font-semibold">Date Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-20" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : staff.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No staff found</p>
                  </TableCell>
                </TableRow>
              ) : (
                staff.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-mono text-xs">{member.employeeNumber || '-'}</TableCell>
                    <TableCell className="font-medium">{member.firstName} {member.lastName}</TableCell>
                    <TableCell className="text-sm">{member.designation || '-'}</TableCell>
                    <TableCell className="text-sm">{member.phone || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        member.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-50 text-gray-600 border-gray-200'
                      }>
                        {member.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(member.dateJoined)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
