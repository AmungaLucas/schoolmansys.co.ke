'use client';

import { useEffect, useState, useCallback } from 'react';
import { CalendarCheck, Loader2, Save, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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

interface ClassItem {
  id: string;
  name: string;
}

interface AttendanceStudent {
  studentId: string;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  status: string | null;
  remarks: string | null;
  marked: boolean;
}

interface AttendanceSummary {
  total: number;
  present: number;
  absent: number;
  late: number;
  unmarked: number;
}

const statusColors: Record<string, string> = {
  present: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  absent: 'bg-red-50 text-red-700 border-red-200',
  late: 'bg-amber-50 text-amber-700 border-amber-200',
  excused: 'bg-blue-50 text-blue-700 border-blue-200',
};

const statusDotColors: Record<string, string> = {
  present: 'bg-emerald-500',
  absent: 'bg-red-500',
  late: 'bg-amber-500',
  excused: 'bg-blue-500',
};

export default function AttendancePage() {
  const { tenantId } = useSchool();

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [students, setStudents] = useState<AttendanceStudent[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [changed, setChanged] = useState(false);

  // Track changes for save
  const [attendanceData, setAttendanceData] = useState<Record<string, string>>({});

  useEffect(() => {
    async function fetchClasses() {
      try {
        const res = await fetch(`/api/school/${tenantId}/classes`);
        const json = await res.json();
        if (json.success) setClasses(json.data);
      } catch {
        toast.error('Failed to load classes');
      }
    }
    fetchClasses();
  }, [tenantId]);

  const fetchAttendance = useCallback(async () => {
    if (!selectedClass || !selectedDate) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ classId: selectedClass, date: selectedDate });
      const res = await fetch(`/api/school/${tenantId}/attendance?${params}`);
      const json = await res.json();
      if (json.success) {
        setStudents(json.data.students);
        setSummary(json.data.summary);
        const data: Record<string, string> = {};
        json.data.students.forEach((s: AttendanceStudent) => {
          if (s.status) data[s.studentId] = s.status;
        });
        setAttendanceData(data);
        setChanged(false);
      } else {
        toast.error(json.error?.message || 'Failed to load attendance');
      }
    } catch {
      toast.error('Failed to load attendance');
    } finally {
      setLoading(false);
    }
  }, [tenantId, selectedClass, selectedDate]);

  useEffect(() => {
    if (selectedClass) fetchAttendance();
  }, [selectedClass, fetchAttendance]);

  const handleStatusChange = (studentId: string, status: string) => {
    setAttendanceData((prev) => ({ ...prev, [studentId]: status }));
    setChanged(true);
  };

  const handleSave = async () => {
    if (!selectedClass || !selectedDate) return;

    const records = Object.entries(attendanceData)
      .filter(([, status]) => status)
      .map(([studentId, status]) => ({ studentId, status }));

    if (records.length === 0) {
      toast.error('No attendance records to save');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/school/${tenantId}/attendance/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId: selectedClass,
          date: selectedDate,
          records,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Attendance saved', { description: json.data.message });
        setChanged(false);
        fetchAttendance();
      } else {
        toast.error(json.error?.message || 'Failed to save attendance');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
          <p className="text-sm text-gray-500">Mark and manage daily student attendance</p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving || !changed || !selectedClass}
          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Attendance
        </Button>
      </div>

      {/* Controls */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="text-xs font-medium text-gray-500 mb-1.5 block">Class</label>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger><SelectValue placeholder="Select a class" /></SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-xs font-medium text-gray-500 mb-1.5 block">Date</label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Total', value: summary.total, color: 'text-gray-900' },
            { label: 'Present', value: summary.present, color: 'text-emerald-600', dot: 'bg-emerald-500' },
            { label: 'Absent', value: summary.absent, color: 'text-red-600', dot: 'bg-red-500' },
            { label: 'Late', value: summary.late, color: 'text-amber-600', dot: 'bg-amber-500' },
            { label: 'Unmarked', value: summary.unmarked, color: 'text-gray-500', dot: 'bg-gray-300' },
          ].map((item) => (
            <Card key={item.label} className="border-0 shadow-sm">
              <CardContent className="p-3 text-center">
                <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide mt-0.5">{item.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Attendance grid */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="text-xs font-semibold">Adm No</TableHead>
                <TableHead className="text-xs font-semibold">Name</TableHead>
                <TableHead className="text-xs font-semibold">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 3 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-8 w-24" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : !selectedClass ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-12">
                    <CalendarCheck className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Select a class to mark attendance</p>
                  </TableCell>
                </TableRow>
              ) : students.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-12">
                    <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No students enrolled in this class</p>
                  </TableCell>
                </TableRow>
              ) : (
                students.map((student) => (
                  <TableRow key={student.studentId}>
                    <TableCell className="font-mono text-xs">{student.admissionNumber}</TableCell>
                    <TableCell className="font-medium">{student.firstName} {student.lastName}</TableCell>
                    <TableCell>
                      <Select
                        value={attendanceData[student.studentId] || ''}
                        onValueChange={(v) => handleStatusChange(student.studentId, v)}
                      >
                        <SelectTrigger className={`w-36 ${attendanceData[student.studentId] ? statusColors[attendanceData[student.studentId]] : ''}`}>
                          <SelectValue placeholder="Mark..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="present">
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                              Present
                            </span>
                          </SelectItem>
                          <SelectItem value="absent">
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-red-500" />
                              Absent
                            </span>
                          </SelectItem>
                          <SelectItem value="late">
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-amber-500" />
                              Late
                            </span>
                          </SelectItem>
                          <SelectItem value="excused">
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-blue-500" />
                              Excused
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
