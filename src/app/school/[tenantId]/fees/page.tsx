'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import {
  Plus, Loader2, Wallet, Search, ChevronLeft, ChevronRight, CreditCard,
  Smartphone, CheckCircle2, XCircle, Clock, RefreshCw, ShieldAlert,
} from 'lucide-react';
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

// ============================================================================
// Types
// ============================================================================

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

interface MpesaTransaction {
  id: string;
  amount: number;
  phoneNumber: string;
  status: string;
  mpesaReceipt: string | null;
  resultDesc: string | null;
  accountReference: string;
  createdAt: string;
}

// ============================================================================
// Helpers
// ============================================================================

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(amount);
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
}

function normalizePhone(phone: string): string {
  let p = phone.replace(/\s+/g, '');
  if (p.startsWith('+254')) return p;
  if (p.startsWith('254')) return p;
  if (p.startsWith('07') || p.startsWith('01')) return `254${p}`;
  return p;
}

// ============================================================================
// M-Pesa Status Badge
// ============================================================================

function MpesaStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'success':
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1"><CheckCircle2 className="w-3 h-3" /> Success</Badge>;
    case 'pending':
      return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1"><Clock className="w-3 h-3" /> Pending</Badge>;
    case 'failed':
      return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 gap-1"><XCircle className="w-3 h-3" /> Failed</Badge>;
    case 'cancelled':
      return <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200 gap-1"><XCircle className="w-3 h-3" /> Cancelled</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

// ============================================================================
// Main Component
// ============================================================================

export default function FeesPage() {
  const { tenantId } = useSchool();

  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [mpesaTransactions, setMpesaTransactions] = useState<MpesaTransaction[]>([]);

  // M-Pesa availability
  const [mpesaEnabled, setMpesaEnabled] = useState(false);
  const [mpesaConfigured, setMpesaConfigured] = useState(false);

  const [loadingStructures, setLoadingStructures] = useState(true);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [loadingMpesa, setLoadingMpesa] = useState(true);
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

  // M-Pesa dialog
  const [mpesaDialogOpen, setMpesaDialogOpen] = useState(false);
  const [mpesaSubmitting, setMpesaSubmitting] = useState(false);
  const [mpesaForm, setMpesaForm] = useState({
    studentId: '',
    amount: '',
    phoneNumber: '',
  });
  const [mpesaPollInterval, setMpesaPollInterval] = useState<ReturnType<typeof setInterval> | null>(null);
  const mpesaPollingStudentRef = useRef<string | null>(null);

  // Breakdown items for structure
  const [breakdownItems, setBreakdownItems] = useState<{ name: string; amount: string }[]>([
    { name: 'Tuition', amount: '' },
    { name: 'Exam', amount: '' },
  ]);

  // ============================================================================
  // Data Fetching
  // ============================================================================

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

  const fetchMpesaTransactions = useCallback(async () => {
    setLoadingMpesa(true);
    try {
      // Get latest M-Pesa transactions across all students (recent 48h)
      const recentPayments = await fetch(`/api/school/${tenantId}/fees/payments?limit=50&method=mpesa`);
      const payJson = await recentPayments.json();
      if (payJson.success) {
        // Also get pending via mpesa-initiate status for the polling student
        if (mpesaPollingStudentRef.current) {
          const statusRes = await fetch(`/api/school/${tenantId}/fees/mpesa-initiate?studentId=${mpesaPollingStudentRef.current}`);
          const statusJson = await statusRes.json();
          if (statusJson.success && statusJson.data.hasPending) {
            // Merge pending txns into the list
            setMpesaTransactions(statusJson.data.transactions);
          }
        }
      }
    } catch {
      // silent
    } finally {
      setLoadingMpesa(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchStructures();
    fetchPayments();
  }, [fetchStructures, fetchPayments]);

  useEffect(() => {
    async function fetchMeta() {
      try {
        const [studentsRes, classesRes, ayRes, tenantInfoRes] = await Promise.all([
          fetch(`/api/school/${tenantId}/students?limit=100`),
          fetch(`/api/school/${tenantId}/classes`),
          fetch(`/api/school/${tenantId}/academic-years`),
          fetch(`/api/auth/school/tenant-info?tenantId=${tenantId}`),
        ]);
        const [sJson, cJson, aJson, tJson] = await Promise.all([studentsRes.json(), classesRes.json(), ayRes.json(), tenantInfoRes.json()]);
        if (sJson.success) setStudents(sJson.data.students);
        if (cJson.success) setClasses(cJson.data);
        if (aJson.success) setAcademicYears(aJson.data);
        if (tJson.success) {
          setMpesaEnabled(!!tJson.data.mpesaStkEnabled);
          setMpesaConfigured(!!tJson.data.hasMpesaConfig);
        }
      } catch {
        // silent
      }
    }
    fetchMeta();
  }, [tenantId]);

  // Clean up polling interval on unmount
  useEffect(() => {
    return () => {
      if (mpesaPollInterval) clearInterval(mpesaPollInterval);
    };
  }, [mpesaPollInterval]);

  // ============================================================================
  // Handlers
  // ============================================================================

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
        // Refresh student list to update balances
        const sRes = await fetch(`/api/school/${tenantId}/students?limit=100`);
        const sJson = await sRes.json();
        if (sJson.success) setStudents(sJson.data.students);
      } else {
        toast.error(json.error?.message || 'Failed to record payment');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const handleMpesaInitiate = async () => {
    if (!mpesaForm.studentId || !mpesaForm.amount || !mpesaForm.phoneNumber) {
      toast.error('Student, amount, and phone number are required');
      return;
    }

    const phone = normalizePhone(mpesaForm.phoneNumber);
    if (phone.length < 12) {
      toast.error('Enter a valid Kenyan phone number (e.g., 0712345678)');
      return;
    }

    setMpesaSubmitting(true);
    try {
      const res = await fetch(`/api/school/${tenantId}/fees/mpesa-initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: mpesaForm.studentId,
          amount: Number(mpesaForm.amount),
          phoneNumber: phone,
        }),
      });
      const json = await res.json();

      if (json.success) {
        toast.success('M-Pesa prompt sent', {
          description: `KES ${Number(mpesaForm.amount).toLocaleString()} - Check your phone to confirm`,
          duration: 8000,
        });

        // Start polling for the result
        mpesaPollingStudentRef.current = mpesaForm.studentId;
        if (mpesaPollInterval) clearInterval(mpesaPollInterval);

        const pollInterval = setInterval(async () => {
          try {
            const statusRes = await fetch(
              `/api/school/${tenantId}/fees/mpesa-initiate?studentId=${mpesaForm.studentId}`
            );
            const statusJson = await statusRes.json();
            if (statusJson.success && statusJson.data.pendingTransaction) {
              const pending = statusJson.data.pendingTransaction;
              if (pending.status !== 'pending') {
                clearInterval(pollInterval);
                setMpesaPollInterval(null);
                mpesaPollingStudentRef.current = null;

                if (pending.status === 'success') {
                  toast.success('M-Pesa payment confirmed!', {
                    description: `Receipt: ${pending.mpesaReceipt || 'N/A'} - KES ${pending.amount.toLocaleString()}`,
                    duration: 10000,
                  });
                  fetchPayments();
                  // Refresh student list
                  const sRes = await fetch(`/api/school/${tenantId}/students?limit=100`);
                  const sJson = await sRes.json();
                  if (sJson.success) setStudents(sJson.data.students);
                } else {
                  toast.error('M-Pesa payment failed', {
                    description: pending.resultDesc || 'The payment was not completed',
                  });
                }
              }
            }
          } catch {
            // Poll silently
          }
        }, 5000); // Poll every 5 seconds

        setMpesaPollInterval(pollInterval);

        // Auto-stop polling after 3 minutes (STK Push expires in ~60s)
        setTimeout(() => {
          if (mpesaPollInterval) {
            clearInterval(mpesaPollInterval);
            setMpesaPollInterval(null);
            mpesaPollingStudentRef.current = null;
            toast.info('M-Pesa polling stopped - payment confirmation timed out');
          }
        }, 180000);

        // Don't close dialog immediately - show a pending state
        setMpesaSubmitting(false);
        // Reset form after a short delay
        setTimeout(() => {
          setMpesaForm({ studentId: '', amount: '', phoneNumber: '' });
        }, 500);

      } else {
        toast.error(json.error?.message || 'Failed to initiate M-Pesa payment');
        setMpesaSubmitting(false);
      }
    } catch {
      toast.error('Network error - could not reach M-Pesa');
      setMpesaSubmitting(false);
    }
  };

  // Set amount to student's balance when student is selected in M-Pesa form
  const handleMpesaStudentChange = (studentId: string) => {
    const student = students.find((s) => s.id === studentId);
    setMpesaForm((prev) => ({
      ...prev,
      studentId,
      amount: student && student.currentFeeBalance > 0 ? String(Math.ceil(student.currentFeeBalance)) : prev.amount,
    }));
  };

  const selectedStudent = students.find((s) => s.id === mpesaForm.studentId);

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
          <TabsTrigger value="mpesa" className="gap-1.5"><Smartphone className="w-3.5 h-3.5" /> M-Pesa</TabsTrigger>
        </TabsList>

        {/* Fee Structures Tab */}
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

        {/* Payments Tab */}
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
            <div className="flex gap-2">
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
                    <DialogDescription>Record a new fee payment from a student (cash, bank, or manual M-Pesa).</DialogDescription>
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
                        <TableCell className="text-sm">
                          <Badge variant="outline" className={
                            p.method === 'mpesa'
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : 'bg-gray-50 text-gray-600 border-gray-200'
                          }>
                            {p.method === 'mpesa' && <Smartphone className="w-3 h-3 mr-1" />}
                            {p.method.replace('_', ' ')}
                          </Badge>
                        </TableCell>
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

        {/* M-Pesa Tab */}
        <TabsContent value="mpesa" className="space-y-4">
          {!mpesaEnabled || !mpesaConfigured ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="py-12">
                <div className="text-center max-w-md mx-auto">
                  <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <ShieldAlert className="w-6 h-6 text-gray-400" />
                  </div>
                  <h3 className="text-base font-semibold text-gray-900">M-Pesa is not yet configured for this school.</h3>
                  <p className="text-sm text-gray-500 mt-2">
                    Contact the SchoolManSys administrator to set up
                    M-Pesa integration for your school.
                  </p>
                  <p className="text-xs text-muted-foreground mt-3">
                    support@schoolmansys.co.ke
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
          <>
          {/* M-Pesa Initiate Section */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                    <Smartphone className="w-5 h-5 text-green-700" />
                  </div>
                  <div>
                    <CardTitle className="text-base">M-Pesa STK Push</CardTitle>
                    <CardDescription>Send a payment prompt directly to a parent/guardian&apos;s phone</CardDescription>
                  </div>
                </div>
                <Dialog open={mpesaDialogOpen} onOpenChange={setMpesaDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-green-600 hover:bg-green-700 text-white gap-2">
                      <Smartphone className="w-4 h-4" />
                      Send M-Pesa Prompt
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Smartphone className="w-5 h-5 text-green-600" />
                        Send M-Pesa Payment Prompt
                      </DialogTitle>
                      <DialogDescription>
                        This will send an STK Push notification to the phone number. The parent/guardian must confirm on their phone.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="space-y-2">
                        <Label>Student *</Label>
                        <Select value={mpesaForm.studentId} onValueChange={handleMpesaStudentChange}>
                          <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                          <SelectContent>
                            {students.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.firstName} {s.lastName} ({s.admissionNumber})
                                <span className="text-gray-400 ml-2">Bal: {formatCurrency(s.currentFeeBalance)}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {selectedStudent && (
                          <p className="text-xs text-gray-500">
                            Outstanding balance: <span className="font-semibold text-red-600">{formatCurrency(selectedStudent.currentFeeBalance)}</span>
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>Amount (KES) *</Label>
                        <Input
                          type="number"
                          value={mpesaForm.amount}
                          onChange={(e) => setMpesaForm({ ...mpesaForm, amount: e.target.value })}
                          placeholder="Enter amount"
                          min="1"
                          max="150000"
                        />
                        <p className="text-xs text-gray-400">Maximum KES 150,000 per transaction</p>
                      </div>
                      <div className="space-y-2">
                        <Label>M-Pesa Phone Number *</Label>
                        <Input
                          type="tel"
                          value={mpesaForm.phoneNumber}
                          onChange={(e) => setMpesaForm({ ...mpesaForm, phoneNumber: e.target.value })}
                          placeholder="e.g., 0712345678"
                        />
                        <p className="text-xs text-gray-400">The phone number registered on M-Pesa</p>
                      </div>

                      {mpesaPollInterval && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2">
                          <Loader2 className="w-4 h-4 text-amber-600 animate-spin" />
                          <p className="text-sm text-amber-700">
                            Waiting for payment confirmation... The parent should check their phone.
                          </p>
                        </div>
                      )}
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => {
                        setMpesaDialogOpen(false);
                        if (mpesaPollInterval) {
                          clearInterval(mpesaPollInterval);
                          setMpesaPollInterval(null);
                          mpesaPollingStudentRef.current = null;
                        }
                      }}>
                        {mpesaPollInterval ? 'Stop & Close' : 'Cancel'}
                      </Button>
                      <Button
                        onClick={handleMpesaInitiate}
                        disabled={mpesaSubmitting || !!mpesaPollInterval}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        {mpesaSubmitting ? (
                          <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Sending...</>
                        ) : mpesaPollInterval ? (
                          <><Clock className="w-4 h-4 mr-2" /> Awaiting Confirmation</>
                        ) : (
                          <><Smartphone className="w-4 h-4 mr-2" /> Send Prompt</>
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                <strong>How it works:</strong> Enter the student and phone number, then click &quot;Send Prompt&quot;.
                The parent receives an M-Pesa notification on their phone to confirm payment.
                The system automatically records the payment once confirmed.
                You can also use &quot;Record Payment&quot; to manually log M-Pesa payments already received.
              </div>
            </CardContent>
          </Card>

          {/* Recent M-Pesa Transactions */}
          <Card className="border-0 shadow-sm overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Recent M-Pesa Transactions</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { if (mpesaPollingStudentRef.current) fetchMpesaTransactions(); }}
                  className="text-xs gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Refresh
                </Button>
              </div>
            </CardHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="text-xs font-semibold">Phone</TableHead>
                    <TableHead className="text-xs font-semibold">Amount</TableHead>
                    <TableHead className="text-xs font-semibold">Status</TableHead>
                    <TableHead className="text-xs font-semibold">Receipt</TableHead>
                    <TableHead className="text-xs font-semibold">Reference</TableHead>
                    <TableHead className="text-xs font-semibold">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingMpesa ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 6 }).map((_, j) => (
                          <TableCell key={j}><Skeleton className="h-5 w-20" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : mpesaTransactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10">
                        <Smartphone className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">No M-Pesa transactions yet</p>
                        <p className="text-xs text-gray-400 mt-1">Use &quot;Send M-Pesa Prompt&quot; to initiate a payment</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    mpesaTransactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="font-mono text-sm">{tx.phoneNumber}</TableCell>
                        <TableCell className="font-medium text-emerald-700">{formatCurrency(tx.amount)}</TableCell>
                        <TableCell><MpesaStatusBadge status={tx.status} /></TableCell>
                        <TableCell className="font-mono text-xs">{tx.mpesaReceipt || '-'}</TableCell>
                        <TableCell className="text-xs text-gray-500">{tx.accountReference}</TableCell>
                        <TableCell className="text-xs text-gray-500">{formatTime(tx.createdAt)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
          </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
