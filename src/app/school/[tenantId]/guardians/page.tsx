'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Loader2, ChevronLeft, ChevronRight, UserCheck, Phone, Mail, Briefcase } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

interface Guardian {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  idNumber: string | null;
  occupation: string | null;
  relationship: string | null;
  address: string | null;
  linkedStudents: {
    id: string;
    firstName: string;
    lastName: string;
    admissionNumber: string;
    relationship: string;
    isPrimary: boolean;
  }[];
}

export default function GuardiansPage() {
  const { tenantId } = useSchool();

  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Add guardian dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    idNumber: '',
    occupation: '',
    relationship: '',
    address: '',
  });

  const fetchGuardians = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '10' });
      if (search) params.set('search', search);
      const res = await fetch(`/api/school/${tenantId}/guardians?${params}`);
      const json = await res.json();
      if (json.success) {
        setGuardians(json.data.guardians);
        setTotalPages(json.data.pagination.totalPages);
      }
    } catch {
      toast.error('Failed to load guardians');
    } finally {
      setLoading(false);
    }
  }, [tenantId, search, page]);

  useEffect(() => {
    fetchGuardians();
  }, [fetchGuardians]);

  const handleAddGuardian = async () => {
    if (!form.firstName || !form.lastName || !form.phone) {
      toast.error('First name, last name, and phone are required');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/school/${tenantId}/guardians`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          phone: form.phone,
          email: form.email || undefined,
          idNumber: form.idNumber || undefined,
          occupation: form.occupation || undefined,
          relationship: form.relationship || undefined,
          address: form.address || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Guardian added successfully');
        setDialogOpen(false);
        setForm({ firstName: '', lastName: '', phone: '', email: '', idNumber: '', occupation: '', relationship: '', address: '' });
        fetchGuardians();
      } else {
        toast.error(json.error?.message || 'Failed to add guardian');
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
          <h1 className="text-2xl font-bold text-gray-900">Guardians</h1>
          <p className="text-sm text-gray-500">Manage student parents and guardians</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
              <Plus className="w-4 h-4" />
              Add Guardian
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Guardian</DialogTitle>
              <DialogDescription>Enter the guardian&apos;s details.</DialogDescription>
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
                  <Label>Phone *</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+254..." />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>ID Number</Label>
                  <Input value={form.idNumber} onChange={(e) => setForm({ ...form, idNumber: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Relationship</Label>
                  <Select value={form.relationship} onValueChange={(v) => setForm({ ...form, relationship: v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="parent">Parent</SelectItem>
                      <SelectItem value="guardian">Guardian</SelectItem>
                      <SelectItem value="relative">Relative</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Occupation</Label>
                  <Input value={form.occupation} onChange={(e) => setForm({ ...form, occupation: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleAddGuardian} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Add Guardian
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
              placeholder="Search by name, phone, or email..."
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
                <TableHead className="text-xs font-semibold">Name</TableHead>
                <TableHead className="text-xs font-semibold">Phone</TableHead>
                <TableHead className="text-xs font-semibold">Email</TableHead>
                <TableHead className="text-xs font-semibold">Occupation</TableHead>
                <TableHead className="text-xs font-semibold">Children</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-20" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : guardians.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12">
                    <UserCheck className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No guardians found</p>
                  </TableCell>
                </TableRow>
              ) : (
                guardians.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{g.firstName} {g.lastName}</p>
                        {g.relationship && <p className="text-xs text-gray-400 capitalize">{g.relationship}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{g.phone}</TableCell>
                    <TableCell className="text-sm">{g.email || '-'}</TableCell>
                    <TableCell className="text-sm">{g.occupation || '-'}</TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{g.linkedStudents?.length || 0}</div>
                      {g.linkedStudents?.length > 0 && (
                        <p className="text-[10px] text-gray-400 truncate max-w-[150px]">
                          {g.linkedStudents.map((s) => s.firstName).join(', ')}
                        </p>
                      )}
                    </TableCell>
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
