'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Loader2, BookOpen, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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

interface ClassItem {
  id: string;
  name: string;
  capacity: number;
  level: { id: string; name: string; levelOrder: number } | null;
  classTeacher: { id: string; firstName: string; lastName: string } | null;
  studentCount: number;
  createdAt: string;
}

interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
}

interface LearningLevel {
  id: string;
  name: string;
}

export default function ClassesPage() {
  const { tenantId } = useSchool();

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [levels, setLevels] = useState<LearningLevel[]>([]);
  const [loading, setLoading] = useState(true);

  // Add class dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    levelId: '',
    classTeacherId: '',
    capacity: '40',
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [classesRes, staffRes, levelsRes] = await Promise.all([
        fetch(`/api/school/${tenantId}/classes`),
        fetch(`/api/school/${tenantId}/staff?limit=100`),
        fetch(`/api/school/${tenantId}/classes`),
      ]);
      const [classesJson, staffJson] = await Promise.all([classesRes.json(), staffRes.json()]);
      if (classesJson.success) {
        setClasses(classesJson.data);
        // Extract unique levels from classes
        const levelMap = new Map<string, LearningLevel>();
        classesJson.data.forEach((c: ClassItem) => {
          if (c.level) levelMap.set(c.level.id, c.level);
        });
        setLevels(Array.from(levelMap.values()));
      }
      if (staffJson.success) {
        setStaff(staffJson.data.staff);
      }
    } catch {
      toast.error('Failed to load classes');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddClass = async () => {
    if (!form.name) {
      toast.error('Class name is required');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/school/${tenantId}/classes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          levelId: form.levelId || undefined,
          classTeacherId: form.classTeacherId || undefined,
          capacity: Number(form.capacity) || 40,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Class added successfully');
        setDialogOpen(false);
        setForm({ name: '', levelId: '', classTeacherId: '', capacity: '40' });
        fetchData();
      } else {
        toast.error(json.error?.message || 'Failed to add class');
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
          <h1 className="text-2xl font-bold text-gray-900">Classes</h1>
          <p className="text-sm text-gray-500">Manage school classes and streams</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
              <Plus className="w-4 h-4" />
              Add Class
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Class</DialogTitle>
              <DialogDescription>Create a new class or stream.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Class Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Grade 1A" />
              </div>
              <div className="space-y-2">
                <Label>Learning Level</Label>
                <Select value={form.levelId} onValueChange={(v) => setForm({ ...form, levelId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger>
                  <SelectContent>
                    {levels.map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Class Teacher</Label>
                <Select value={form.classTeacherId} onValueChange={(v) => setForm({ ...form, classTeacherId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
                  <SelectContent>
                    {staff.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.firstName} {s.lastName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Capacity</Label>
                <Input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleAddClass} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Add Class
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Classes grid/table */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="text-xs font-semibold">Class Name</TableHead>
                <TableHead className="text-xs font-semibold">Level</TableHead>
                <TableHead className="text-xs font-semibold">Teacher</TableHead>
                <TableHead className="text-xs font-semibold">Students</TableHead>
                <TableHead className="text-xs font-semibold">Capacity</TableHead>
                <TableHead className="text-xs font-semibold">Utilization</TableHead>
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
              ) : classes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No classes found</p>
                  </TableCell>
                </TableRow>
              ) : (
                classes.map((cls) => {
                  const utilization = cls.capacity > 0 ? Math.round((cls.studentCount / cls.capacity) * 100) : 0;
                  return (
                    <TableRow key={cls.id}>
                      <TableCell className="font-medium">{cls.name}</TableCell>
                      <TableCell className="text-sm">
                        {cls.level ? (
                          <Badge variant="secondary">{cls.level.name}</Badge>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {cls.classTeacher ? `${cls.classTeacher.firstName} ${cls.classTeacher.lastName}` : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-sm font-medium">{cls.studentCount}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{cls.capacity}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-[120px]">
                          <Progress value={utilization} className="h-2 flex-1" />
                          <span className={`text-xs font-medium ${
                            utilization >= 90 ? 'text-red-600' : utilization >= 70 ? 'text-amber-600' : 'text-emerald-600'
                          }`}>
                            {utilization}%
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
