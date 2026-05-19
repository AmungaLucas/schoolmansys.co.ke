'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  User,
  GraduationCap,
  Wallet,
  Users,
  FileText,
  Loader2,
  Calendar,
  Phone,
  Mail,
  Briefcase,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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

interface StudentDetail {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  gender: string | null;
  birthCertNumber: string | null;
  nationality: string | null;
  religion: string | null;
  previousSchool: string | null;
  bloodGroup: string | null;
  allergies: string | null;
  currentFeeBalance: number;
  status: string;
  createdAt: string;
  enrolments: {
    id: string;
    classId: string;
    dateEnrolled: string;
    class: {
      id: string;
      name: string;
      level: { name: string } | null;
    } | null;
  }[];
  guardians: {
    guardian: {
      id: string;
      firstName: string;
      lastName: string;
      phone: string;
      email: string | null;
      occupation: string | null;
      relationship: string | null;
    };
  }[];
  feePayments: {
    id: string;
    amount: number;
    method: string;
    reference: string | null;
    receiptNumber: string | null;
    transactionDate: string;
    status: string;
  }[];
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(amount);
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function StudentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params.tenantId as string;
  const studentId = params.id as string;

  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    gender: '',
    dateOfBirth: '',
    status: '',
  });

  useEffect(() => {
    async function fetchStudent() {
      try {
        const res = await fetch(`/api/school/${tenantId}/students/${studentId}`);
        const json = await res.json();
        if (json.success) {
          setStudent(json.data);
        } else {
          toast.error(json.error?.message || 'Student not found');
          router.push(`/school/${tenantId}/students`);
        }
      } catch {
        toast.error('Failed to load student');
        router.push(`/school/${tenantId}/students`);
      } finally {
        setLoading(false);
      }
    }
    fetchStudent();
  }, [tenantId, studentId, router]);

  const openEditDialog = () => {
    if (!student) return;
    setEditForm({
      firstName: student.firstName,
      lastName: student.lastName,
      gender: student.gender || '',
      dateOfBirth: student.dateOfBirth ? student.dateOfBirth.split('T')[0] : '',
      status: student.status,
    });
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    setEditSubmitting(true);
    try {
      const res = await fetch(`/api/school/${tenantId}/students/${studentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Student updated');
        setEditOpen(false);
        setStudent((prev) => prev ? { ...prev, ...editForm } : prev);
      } else {
        toast.error(json.error?.message || 'Failed to update');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setEditSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="h-72" />
          <Skeleton className="h-72 lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (!student) return null;

  return (
    <div className="space-y-4">
      {/* Back nav */}
      <Button variant="ghost" size="sm" onClick={() => router.push(`/school/${tenantId}/students`)} className="gap-2">
        <ArrowLeft className="w-4 h-4" />
        Back to Students
      </Button>

      {/* Student info card */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-6">
            {/* Avatar placeholder */}
            <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
              <User className="w-10 h-10 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h1 className="text-xl font-bold text-gray-900">
                    {student.firstName} {student.lastName}
                  </h1>
                  <p className="text-sm text-gray-500 font-mono">{student.admissionNumber}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={
                    student.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : ''
                  }>
                    {student.status}
                  </Badge>
                  <Button variant="outline" size="sm" onClick={openEditDialog}>Edit</Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 text-sm text-gray-600">
                {student.gender && <span className="capitalize">Gender: {student.gender}</span>}
                <span>DOB: {formatDate(student.dateOfBirth)}</span>
                {student.birthCertNumber && <span>UPI: {student.birthCertNumber}</span>}
                {student.nationality && <span>Nationality: {student.nationality}</span>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" className="gap-1.5"><FileText className="w-3.5 h-3.5" /> Overview</TabsTrigger>
          <TabsTrigger value="fees" className="gap-1.5"><Wallet className="w-3.5 h-3.5" /> Fees</TabsTrigger>
          <TabsTrigger value="guardians" className="gap-1.5"><Users className="w-3.5 h-3.5" /> Guardians</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Enrollment Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {student.enrolments.length > 0 ? student.enrolments.map((enr) => (
                    <div key={enr.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{enr.class?.name || 'Unknown Class'}</p>
                        {enr.class?.level && <p className="text-xs text-gray-500">{enr.class.level.name}</p>}
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">Active</Badge>
                        <p className="text-[10px] text-gray-400 mt-1">Enrolled {formatDate(enr.dateEnrolled)}</p>
                      </div>
                    </div>
                  )) : (
                    <p className="text-sm text-gray-500">No active enrollment</p>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Fee Balance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-4">
                  <p className={`text-3xl font-bold ${student.currentFeeBalance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {formatCurrency(student.currentFeeBalance)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Outstanding Balance</p>
                </div>
                <div className="space-y-2 mt-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Total Payments</span>
                    <span className="font-medium">
                      {formatCurrency(student.feePayments.reduce((sum, p) => sum + p.amount, 0))}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Payment Count</span>
                    <span className="font-medium">{student.feePayments.length}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="fees">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Payment History</CardTitle>
              <CardDescription>All fee payments for this student</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="text-xs font-semibold">Receipt</TableHead>
                      <TableHead className="text-xs font-semibold">Date</TableHead>
                      <TableHead className="text-xs font-semibold">Amount</TableHead>
                      <TableHead className="text-xs font-semibold">Method</TableHead>
                      <TableHead className="text-xs font-semibold">Reference</TableHead>
                      <TableHead className="text-xs font-semibold">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {student.feePayments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-sm text-gray-500">
                          No payment records
                        </TableCell>
                      </TableRow>
                    ) : (
                      student.feePayments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell className="font-mono text-xs">{payment.receiptNumber || '-'}</TableCell>
                          <TableCell className="text-sm">{formatDate(payment.transactionDate)}</TableCell>
                          <TableCell className="font-medium text-sm text-emerald-700">{formatCurrency(payment.amount)}</TableCell>
                          <TableCell className="text-sm capitalize">{payment.method}</TableCell>
                          <TableCell className="font-mono text-xs">{payment.reference || '-'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={
                              payment.status === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : ''
                            }>
                              {payment.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="guardians">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Linked Guardians</CardTitle>
              <CardDescription>Parents and guardians associated with this student</CardDescription>
            </CardHeader>
            <CardContent>
              {student.guardians.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No guardians linked</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {student.guardians.map((g, idx) => (
                    <div key={idx} className="p-4 rounded-lg border border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                          <User className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm text-gray-900 truncate">
                            {g.guardian.firstName} {g.guardian.lastName}
                          </p>
                          {g.guardian.relationship && (
                            <Badge variant="secondary" className="text-xs">{g.guardian.relationship}</Badge>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 space-y-1 text-xs text-gray-500">
                        {g.guardian.phone && (
                          <div className="flex items-center gap-2"><Phone className="w-3 h-3" />{g.guardian.phone}</div>
                        )}
                        {g.guardian.email && (
                          <div className="flex items-center gap-2"><Mail className="w-3 h-3" />{g.guardian.email}</div>
                        )}
                        {g.guardian.occupation && (
                          <div className="flex items-center gap-2"><Briefcase className="w-3 h-3" />{g.guardian.occupation}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Student</DialogTitle>
            <DialogDescription>Update student information</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input value={editForm.firstName} onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input value={editForm.lastName} onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Gender</Label>
                <Select value={editForm.gender} onValueChange={(v) => setEditForm({ ...editForm, gender: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date of Birth</Label>
                <Input type="date" value={editForm.dateOfBirth} onChange={(e) => setEditForm({ ...editForm, dateOfBirth: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="transferred">Transferred</SelectItem>
                  <SelectItem value="withdrawn">Withdrawn</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={editSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {editSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
