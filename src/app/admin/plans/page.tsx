'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Plus,
  Pencil,
  CreditCard,
  Users,
  GraduationCap,
  Loader2,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';

interface Plan {
  id: string;
  name: string;
  price: number;
  durationDays: number;
  maxStudents: number;
  maxStaff: number;
  features: string;
  isActive: boolean;
  _count: {
    tenants: number;
  };
}

interface PlanForm {
  id?: string;
  name: string;
  price: string;
  durationDays: string;
  maxStudents: string;
  maxStaff: string;
  features: string;
  isActive: boolean;
}

const defaultForm: PlanForm = {
  name: '',
  price: '0',
  durationDays: '365',
  maxStudents: '100',
  maxStaff: '20',
  features: '{}',
  isActive: true,
};

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [form, setForm] = useState<PlanForm>(defaultForm);
  const [saving, setSaving] = useState(false);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/plans');
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message || 'Failed to load plans');
        return;
      }
      setPlans(json.data);
    } catch {
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const openCreate = () => {
    setEditingPlan(null);
    setForm(defaultForm);
    setDialogOpen(true);
  };

  const openEdit = (plan: Plan) => {
    setEditingPlan(plan);
    setForm({
      id: plan.id,
      name: plan.name,
      price: plan.price.toString(),
      durationDays: plan.durationDays.toString(),
      maxStudents: plan.maxStudents.toString(),
      maxStaff: plan.maxStaff.toString(),
      features: plan.features,
      isActive: plan.isActive,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Plan name is required');
      return;
    }

    setSaving(true);
    try {
      const isEdit = !!editingPlan;
      const url = isEdit ? `/api/admin/plans/${editingPlan!.id}` : '/api/admin/plans';
      const method = isEdit ? 'PATCH' : 'POST';

      const body: Record<string, unknown> = {
        name: form.name,
        price: Number(form.price) || 0,
        durationDays: Number(form.durationDays) || 365,
        maxStudents: Number(form.maxStudents) || 100,
        maxStaff: Number(form.maxStaff) || 20,
        features: form.features || '{}',
      };

      if (isEdit) {
        body.isActive = form.isActive;
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message || `Failed to ${isEdit ? 'update' : 'create'} plan`);
        return;
      }

      toast.success(`Plan ${isEdit ? 'updated' : 'created'} successfully`);
      setDialogOpen(false);
      fetchPlans();
    } catch {
      toast.error('Network error');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const parseFeatures = (features: string): string[] => {
    try {
      const obj = JSON.parse(features);
      return Object.keys(obj);
    } catch {
      return [];
    }
  };

  const planColors = [
    'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white',
    'border-blue-200 bg-gradient-to-br from-blue-50 to-white',
    'border-purple-200 bg-gradient-to-br from-purple-50 to-white',
    'border-amber-200 bg-gradient-to-br from-amber-50 to-white',
  ];

  const planIcons = [
    <GraduationCap key="g" className="w-5 h-5 text-emerald-600" />,
    <CreditCard key="c" className="w-5 h-5 text-blue-600" />,
    <Users key="u" className="w-5 h-5 text-purple-600" />,
    <CreditCard key="c2" className="w-5 h-5 text-amber-600" />,
  ];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Plans</h1>
          <p className="text-muted-foreground">Manage subscription plans for schools</p>
        </div>
        <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" />
          Create Plan
        </Button>
      </div>

      {/* Plan cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-xl" />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <CreditCard className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-lg font-medium">No plans yet</h3>
            <p className="text-sm text-muted-foreground mt-1">Create your first subscription plan to get started.</p>
            <Button className="mt-4 bg-emerald-600 hover:bg-emerald-700" onClick={openCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Create Plan
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan, index) => {
            const features = parseFeatures(plan.features);
            const colorClass = planColors[index % planColors.length];
            const icon = planIcons[index % planIcons.length];

            return (
              <Card key={plan.id} className={`relative border ${colorClass}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {icon}
                      <CardTitle className="text-lg">{plan.name}</CardTitle>
                    </div>
                    <Badge variant={plan.isActive ? 'default' : 'secondary'} className="text-xs">
                      {plan.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <CardDescription>
                    {plan._count.tenants} school{plan._count.tenants !== 1 ? 's' : ''} on this plan
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <span className="text-3xl font-bold">{formatCurrency(plan.price)}</span>
                    <span className="text-sm text-muted-foreground ml-1">
                      / {plan.durationDays} days
                    </span>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Max Students</span>
                      <span className="font-medium">{plan.maxStudents}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Max Staff</span>
                      <span className="font-medium">{plan.maxStaff}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Duration</span>
                      <span className="font-medium">{plan.durationDays} days</span>
                    </div>
                  </div>

                  {features.length > 0 && (
                    <>
                      <div className="border-t pt-3">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Features</p>
                        <div className="flex flex-wrap gap-1.5">
                          {features.slice(0, 5).map((f) => (
                            <Badge key={f} variant="outline" className="text-xs font-normal">
                              {f.replace(/_/g, ' ')}
                            </Badge>
                          ))}
                          {features.length > 5 && (
                            <Badge variant="outline" className="text-xs font-normal">
                              +{features.length - 5} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  <Button
                    variant="outline"
                    className="w-full mt-2"
                    onClick={() => openEdit(plan)}
                  >
                    <Pencil className="w-3.5 h-3.5 mr-2" />
                    Edit Plan
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPlan ? 'Edit Plan' : 'Create New Plan'}</DialogTitle>
            <DialogDescription>
              {editingPlan
                ? 'Update plan details and limits.'
                : 'Define a new subscription plan for schools.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="plan-name">Plan Name *</Label>
              <Input
                id="plan-name"
                placeholder="e.g., Standard"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="plan-price">Price (KES)</Label>
                <Input
                  id="plan-price"
                  type="number"
                  placeholder="0"
                  value={form.price}
                  onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="plan-duration">Duration (days)</Label>
                <Input
                  id="plan-duration"
                  type="number"
                  placeholder="365"
                  value={form.durationDays}
                  onChange={(e) => setForm((p) => ({ ...p, durationDays: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="plan-students">Max Students</Label>
                <Input
                  id="plan-students"
                  type="number"
                  placeholder="100"
                  value={form.maxStudents}
                  onChange={(e) => setForm((p) => ({ ...p, maxStudents: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="plan-staff">Max Staff</Label>
                <Input
                  id="plan-staff"
                  type="number"
                  placeholder="20"
                  value={form.maxStaff}
                  onChange={(e) => setForm((p) => ({ ...p, maxStaff: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="plan-features">Features (JSON)</Label>
              <Input
                id="plan-features"
                placeholder='{"attendance": true, "fees": true}'
                value={form.features}
                onChange={(e) => setForm((p) => ({ ...p, features: e.target.value }))}
                className="font-mono text-sm"
              />
            </div>
            {editingPlan && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="plan-active"
                  checked={form.isActive}
                  onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="plan-active" className="text-sm cursor-pointer">
                  Plan is active and available for new schools
                </Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : editingPlan ? (
                'Update Plan'
              ) : (
                'Create Plan'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
