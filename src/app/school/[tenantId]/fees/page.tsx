'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Plus, Loader2, Wallet, Search, ChevronLeft, ChevronRight, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

interface FeeStructure {
  id: string;
  name: string;
  totalAmount: number;
  status: string;
  breakdown: string;
  createdAt: string;
}

interface FeePayment {
  id: string;
  amount: number;
  method: string;
  reference: string | null;
  receiptNumber: string | null;
  transactionDate: string;
  status: string;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    admissionNumber: string;
  };
}

interface Student {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  currentFeeBalance: number;
}

interface ClassItem {
  id: string;
  name: string;
}

interface AcademicYear {
  id: string;
  name: string;
}

interface Term {
  id: string;
  name: string;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(amount);
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function FeesPage() {
  const { tenantId } = useSchool();
  const params = useParams();

  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);

  const [loadingStructures, setLoadingStructures] = useState(true);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [paymentPage, setPaymentPage] = useState(1);
  const [paymentTotalPages, setPaymentTotalPages] = useState(1);
  const [paymentSearch, setPaymentSearch] = useState('');

  // Create structure dialog
  const [structureDialogOpen, setStructureDialogOpen] = useState(false);
  const [structureSubmitting, setStructureSubmitting] = useState(false);
  const [structureForm, setStructureForm] = useState({
    name: '',
    academicYearId: '',
    termId: '',
    classId: '',
    totalAmount: '',
  });

  // Record payment dialog
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    studentId: '',
    amount: '',
    method: 'cash',
    reference: '',
  });

  // Breakdown items for structure
  const [breakdownItems, setBreakdownItems] = useState<{ name: string; amount: string }[]>([
    { name: 'Tuition', amount: '' },
    { name: 'Exam', amount: '' },
  ]);

  const fetchStructures = useCallback(async () => {
    setLoadingStructures(true);
    try {
      const res = await fetch(`/api/school/${tenantId}/fees/structures`);
      const json = await res.json();
      if (json.success) setStructures(json.data);
    } catch {
      toast.error('Failed to load fee structures');
    } finally {
      setLoadingStructures(false);
    }
  }, [tenantId]);

  const fetchPayments = useCallback(async () => {
    setLoadingPayments(true);
    try {
      const searchParams = new URLSearchParams({ page: String(paymentPage), limit: '10' });
      if (paymentSearch) searchParams.set('studentId', paymentSearch);
      const res = await fetch(`/api/school/${tenantId}/fees/payments?${searchParams}`);
      const json = await res.json();
      if (json.success) {
        setPayments(json.data.payments);
        setPaymentTotalPages(json.data.pagination.totalPages);
      }
    } catch {
      toast.error('Failed to load payments');
    } finally {
      setLoadingPayments(false);
    }
  }, [tenantId, paymentPage, paymentSearch]);

  useEffect(() => {
    fetchStructures();
    fetchPayments();
  }, [fetchStructures, fetchPayments]);

  useEffect(() => {
    async function fetchMeta() {
      try {
        const [studentsRes, classesRes, ayRes] = await Promise.all([
          fetch(`/api/school/${tenantId}/students?limit=100`),
          fetch(`/api/school/${tenantId}/classes`),
          fetch(`/api/school/${tenantId}/academic-years`),
        ]);
        const [sJson, cJson, aJson] = await Promise.all([studentsRes.json(), classesRes.json(), ayRes.json()]);
        if (sJson.success) setStudents(sJson.data.students);
        if (cJson.success) setClasses(cJson.data);
        if (aJson.success) setAcademicYears(aJson.data);
      } catch {
        // silent
      }
    }
    fetchMeta();
  }, [tenantId]);

  const handleCreateStructure = async () => {
    if (!structureForm.name || !structureForm.academicYearId) {
      toast.error('Name and academic year are required');
      return;
    }
    const total = breakdownItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const breakdown: Record<string, number> = {};
    breakdownItems.forEach((item) => {
      if (item.name && item.amount) breakdown[item.name] = Number(item.amount);
    });

    setStructureSubmitting(true);
    try {
      const res = await fetch(`/api/school/${tenantId}/fees/structures`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: structureForm.name,
          academicYearId: structureForm.academicYearId,
          termId: structureForm.termId || undefined,
          classId: structureForm.classId || undefined,
          totalAmount: total || Number(structureForm.totalAmount) || 0,
          breakdown,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Fee structure created');
        setStructureDialogOpen(false);
        setStructureForm({ name: '', academicYearId: '', termId: '', classId: '', totalAmount: '' });
        setBreakdownItems([{ name: 'Tuition', amount: '' }, { name: 'Exam', amount: '' }]);
        fetchStructures();
      } else {
        toast.error(json.error?.message || 'Failed to create');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setStructureSubmitting(false);
    }
  };

  const handleRecordPayment = async () => {
    if (!paymentForm.studentId || !paymentForm.amount) {
      toast.error('Student and amount are required');
      return;
    }
    setPaymentSubmitting(true);
    try {
      const res = await fetch(`/api/school/${tenantId}/fees/record-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: paymentForm.studentId,
          amount: Number(paymentForm.amount),
          method: paymentForm.method,
          reference: paymentForm.reference || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Payment recorded', { description: `New balance: ${formatCurrency(json.data.newBalance)}` });
        setPaymentDialogOpen(false);
        setPaymentForm({ studentId: '', amount: '', method: 'cash', reference: '' });
        fetchPayments();
      } else {
        toast.error(json.error?.message || 'Failed to record payment');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setPaymentSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Fees</h1>
        <p className="text-sm text-gray-500">Manage fee structures and payment records</p>
      </div>

      <Tabs defaultValue="payments" className="space-y-4">
        <TabsList>
          <TabsTrigger value="structures" className="gap-1.5"><Wallet className="w-3.5 h-3.5" /> Fee Structures</TabsTrigger>
          <TabsTrigger value="payments" className="gap-1.5"><CreditCard className="w-3.5 h-3.5" /> Payments</TabsTrigger>
        </TabsList>

        {/* Fee Structures */}
        <TabsContent value="structures" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={structureDialogOpen} onOpenChange={setStructureDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                  <Plus className="w-4 h-4" />
                  Create Structure
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create Fee Structure</DialogTitle>
                  <DialogDescription>Define a fee structure for a class.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label>Structure Name *</Label>
                    <Input value={structureForm.name} onChange={(e) => setStructureForm({ ...structureForm, name: e.target.value })} placeholder="e.g. Grade 1 Fees 2026" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Academic Year *</Label>
                      <Select value={structureForm.academicYearId} onValueChange={(v) => setStructureForm({ ...structureForm, academicYearId: v })}>
                        <SelectTrigger><SelectValue placeholder="Select year" /></SelectTrigger>
                        <SelectContent>
                          {academicYears.map((ay) => (
                            <SelectItem key={ay.id} value={ay.id}>{ay.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Class</Label>
                      <Select value={structureForm.classId} onValueChange={(v) => setStructureForm({ ...structureForm, classId: v })}>
                        <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                        <SelectContent>
                          {classes.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Breakdown items */}
                  <div className="space-y-2">
                    <Label>Fee Breakdown</Label>
                    <div className="space-y-2">
                      {breakdownItems.map((item, idx) => (
                        <div key={idx} className="flex gap-2">
                          <Input
                            value={item.name}
                            onChange={(e) => {
                              const updated = [...breakdownItems];
                              updated[idx] = { ...updated[idx], name: e.target.value };
                              setBreakdownItems(updated);
                            }}
                            placeholder="Fee item name"
                            className="flex-1"
                          />
                          <Input
                            type="number"
                            value={item.amount}
                            onChange={(e) => {
                              const updated = [...breakdownItems];
                              updated[idx] = { ...updated[idx], amount: e.target.value };
                              setBreakdownItems(updated);
                            }}
                            placeholder="Amount"
                            className="w-32"
                          />
                          {breakdownItems.length > 1 && (
                            <Button variant="ghost" size="icon" onClick={() => setBreakdownItems(breakdownItems.filter((_, i) => i !== idx))} className="shrink-0 h-9 w-9 text-gray-400">
                              &times;
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setBreakdownItems([...breakdownItems, { name: '', amount: '' }])} className="text-xs">
                      + Add Item
                    </Button>
                    <div className="flex justify-between text-sm pt-2 border-t">
                      <span className="text-gray-600 font-medium">Total</span>
                      <span className="font-bold">
                        {formatCurrency(breakdownItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0))}
                      </span>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setStructureDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleCreateStructure} disabled={structureSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    {structureSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Create Structure
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Card className="border-0 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="text-xs font-semibold">Name</TableHead>
                    <TableHead className="text-xs font-semibold">Total Amount</TableHead>
                    <TableHead className="text-xs font-semibold">Status</TableHead>
                    <TableHead className="text-xs font-semibold">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingStructures ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 4 }).map((_, j) => (
                          <TableCell key={j}><Skeleton className="h-5 w-24" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : structures.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-12">
                        <Wallet className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">No fee structures found</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    structures.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell className="font-medium text-emerald-700">{formatCurrency(s.totalAmount)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">{s.status}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{formatDate(s.createdAt)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* Payments */}
        <TabsContent value="payments" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search student by name or admission number..."
                value={paymentSearch}
                onChange={(e) => { setPaymentSearch(e.target.value); setPaymentPage(1); }}
                className="pl-9"
              />
            </div>
            <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                  <Plus className="w-4 h-4" />
                  Record Payment
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Record Fee Payment</DialogTitle>
                  <DialogDescription>Record a new fee payment from a student.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label>Student *</Label>
                    <Select value={paymentForm.studentId} onValueChange={(v) => setPaymentForm({ ...paymentForm, studentId: v })}>
                      <SelectTrigger><SelectValue placeholder="Search and select student" /></SelectTrigger>
                      <SelectContent>
                        {students.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.firstName} {s.lastName} ({s.admissionNumber}) - Bal: {formatCurrency(s.currentFeeBalance)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Amount *</Label>
                    <Input
                      type="number"
                      value={paymentForm.amount}
                      onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                      placeholder="Enter amount"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Method</Label>
                      <Select value={paymentForm.method} onValueChange={(v) => setPaymentForm({ ...paymentForm, method: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="mpesa">M-Pesa</SelectItem>
                          <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                          <SelectItem value="cheque">Cheque</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Reference</Label>
                      <Input
                        value={paymentForm.reference}
                        onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                        placeholder="Transaction ref"
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleRecordPayment} disabled={paymentSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    {paymentSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Record Payment
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Card className="border-0 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="text-xs font-semibold">Student</TableHead>
                    <TableHead className="text-xs font-semibold">Amount</TableHead>
                    <TableHead className="text-xs font-semibold">Method</TableHead>
                    <TableHead className="text-xs font-semibold">Reference</TableHead>
                    <TableHead className="text-xs font-semibold">Date</TableHead>
                    <TableHead className="text-xs font-semibold">Receipt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingPayments ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 6 }).map((_, j) => (
                          <TableCell key={j}><Skeleton className="h-5 w-20" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : payments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12">
                        <CreditCard className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">No payments found</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    payments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium text-sm">
                          {p.student.firstName} {p.student.lastName}
                          <span className="block text-xs text-gray-400 font-mono">{p.student.admissionNumber}</span>
                        </TableCell>
                        <TableCell className="font-medium text-emerald-700">{formatCurrency(p.amount)}</TableCell>
                        <TableCell className="text-sm capitalize">{p.method}</TableCell>
                        <TableCell className="font-mono text-xs">{p.reference || '-'}</TableCell>
                        <TableCell className="text-sm">{formatDate(p.transactionDate)}</TableCell>
                        <TableCell className="font-mono text-xs">{p.receiptNumber || '-'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            {paymentTotalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                <p className="text-xs text-gray-500">Page {paymentPage} of {paymentTotalPages}</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={paymentPage <= 1} onClick={() => setPaymentPage(paymentPage - 1)}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" disabled={paymentPage >= paymentTotalPages} onClick={() => setPaymentPage(paymentPage + 1)}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
