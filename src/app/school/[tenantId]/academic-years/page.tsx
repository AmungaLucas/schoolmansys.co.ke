'use client';

import { useEffect, useState } from 'react';
import { Plus, Loader2, Calendar, CalendarDays, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useSchool } from '../layout';

interface Term {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
}

interface AcademicYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  terms: Term[];
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function AcademicYearsPage() {
  const { tenantId } = useSchool();

  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [loading, setLoading] = useState(true);

  // Create dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    startDate: '',
    endDate: '',
    isCurrent: false,
  });
  const [terms, setTerms] = useState<{ name: string; startDate: string; endDate: string; isCurrent: boolean }[]>([
    { name: 'Term 1', startDate: '', endDate: '', isCurrent: false },
  ]);

  useEffect(() => {
    async function fetchYears() {
      try {
        const res = await fetch(`/api/school/${tenantId}/academic-years`);
        const json = await res.json();
        if (json.success) setAcademicYears(json.data);
      } catch {
        toast.error('Failed to load academic years');
      } finally {
        setLoading(false);
      }
    }
    fetchYears();
  }, [tenantId]);

  const handleCreate = async () => {
    if (!form.name || !form.startDate || !form.endDate) {
      toast.error('Name, start date, and end date are required');
      return;
    }

    // Validate terms
    for (const term of terms) {
      if (term.name && (!term.startDate || !term.endDate)) {
        toast.error(`Term "${term.name}" needs both start and end dates`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const validTerms = terms.filter((t) => t.name && t.startDate && t.endDate);
      const res = await fetch(`/api/school/${tenantId}/academic-years`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          startDate: form.startDate,
          endDate: form.endDate,
          isCurrent: form.isCurrent,
          terms: validTerms,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Academic year created');
        setDialogOpen(false);
        setForm({ name: '', startDate: '', endDate: '', isCurrent: false });
        setTerms([{ name: 'Term 1', startDate: '', endDate: '', isCurrent: false }]);
        // Refresh
        const res2 = await fetch(`/api/school/${tenantId}/academic-years`);
        const json2 = await res2.json();
        if (json2.success) setAcademicYears(json2.data);
      } else {
        toast.error(json.error?.message || 'Failed to create academic year');
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
          <h1 className="text-2xl font-bold text-gray-900">Academic Years</h1>
          <p className="text-sm text-gray-500">Manage academic years and terms</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
              <Plus className="w-4 h-4" />
              Create Year
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Academic Year</DialogTitle>
              <DialogDescription>Define a new academic year with terms.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Year Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. 2026" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date *</Label>
                  <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>End Date *</Label>
                  <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isCurrent"
                  checked={form.isCurrent}
                  onChange={(e) => setForm({ ...form, isCurrent: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="isCurrent" className="text-sm">Set as current academic year</Label>
              </div>

              {/* Terms */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Terms</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTerms([...terms, { name: '', startDate: '', endDate: '', isCurrent: false }])}
                    className="text-xs h-7"
                  >
                    + Add Term
                  </Button>
                </div>
                {terms.map((term, idx) => (
                  <div key={idx} className="p-3 rounded-lg border border-gray-100 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-500">Term {idx + 1}</span>
                      {terms.length > 1 && (
                        <button
                          onClick={() => setTerms(terms.filter((_, i) => i !== idx))}
                          className="text-gray-400 hover:text-red-500 ml-auto"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Input
                        value={term.name}
                        onChange={(e) => {
                          const updated = [...terms];
                          updated[idx] = { ...updated[idx], name: e.target.value };
                          setTerms(updated);
                        }}
                        placeholder="Term name (e.g. Term 1)"
                        className="h-9"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          type="date"
                          value={term.startDate}
                          onChange={(e) => {
                            const updated = [...terms];
                            updated[idx] = { ...updated[idx], startDate: e.target.value };
                            setTerms(updated);
                          }}
                          className="h-9"
                        />
                        <Input
                          type="date"
                          value={term.endDate}
                          onChange={(e) => {
                            const updated = [...terms];
                            updated[idx] = { ...updated[idx], endDate: e.target.value };
                            setTerms(updated);
                          }}
                          className="h-9"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Create Year
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Academic years list */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      ) : academicYears.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-16 text-center">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No academic years found</p>
            <p className="text-xs text-gray-400 mt-1">Create your first academic year to get started</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {academicYears.map((ay) => (
            <Card key={ay.id} className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="w-5 h-5 text-emerald-600" />
                    <CardTitle className="text-lg">{ay.name}</CardTitle>
                  </div>
                  {ay.isCurrent ? (
                    <Badge className="bg-emerald-600 text-white">Current</Badge>
                  ) : (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
                </div>
                <CardDescription>
                  {formatDate(ay.startDate)} &mdash; {formatDate(ay.endDate)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {ay.terms.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="text-xs font-semibold">Term</TableHead>
                        <TableHead className="text-xs font-semibold">Start</TableHead>
                        <TableHead className="text-xs font-semibold">End</TableHead>
                        <TableHead className="text-xs font-semibold">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ay.terms.map((term) => (
                        <TableRow key={term.id}>
                          <TableCell className="font-medium text-sm">{term.name}</TableCell>
                          <TableCell className="text-xs">{formatDate(term.startDate)}</TableCell>
                          <TableCell className="text-xs">{formatDate(term.endDate)}</TableCell>
                          <TableCell>
                            {term.isCurrent ? (
                              <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">Active</Badge>
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">No terms defined</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
