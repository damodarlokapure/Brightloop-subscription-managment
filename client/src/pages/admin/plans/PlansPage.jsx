import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pause, Play, RotateCcw, XCircle, CheckCircle2 } from 'lucide-react';
import api from '../../../lib/api';
import { Button, Input, Select, Modal, Badge, Toast, Spinner } from '../../../components/ui';

const planSchema = z.object({
  name: z.string().min(1, 'Plan name is required'),
  price: z.coerce.number().min(0, 'Price must be >= 0'),
  billingPeriod: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']),
  minQuantity: z.coerce.number().int().min(1, 'Minimum quantity is required'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().optional().or(z.literal('')),
  autoCloseOnEnd: z.boolean().default(false),
  allowEarlyClose: z.boolean().default(false),
  allowPause: z.boolean().default(false),
  allowRenew: z.boolean().default(true),
});

const fetchPlans = async () => {
  const { data } = await api.get('/plans?limit=25&state=ACTIVE');
  return data.data || [];
};

const emptyValues = {
  name: '',
  price: 0,
  billingPeriod: 'MONTHLY',
  minQuantity: 1,
  startDate: new Date().toISOString().slice(0, 10),
  endDate: '',
  autoCloseOnEnd: false,
  allowEarlyClose: false,
  allowPause: false,
  allowRenew: true,
};

function PlanActionButton({ plan, action, label, onPerform, disabledReason, children, variant = 'secondary' }) {
  const disabled = Boolean(disabledReason);
  return (
    <button
      type="button"
      disabled={disabled}
      title={disabled ? disabledReason : ''}
      onClick={() => onPerform(plan.id, action)}
      className={[
        'inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium transition',
        disabled ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100',
        variant === 'danger' && !disabled ? 'border-rose-200 text-rose-600 hover:bg-rose-50' : '',
      ].join(' ')}
    >
      {children}
      {label}
    </button>
  );
}

export function PlansPage() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useState(null);

  const { data: plans = [], isLoading, isError } = useQuery({ queryKey: ['plans'], queryFn: fetchPlans });

  const form = useForm({
    resolver: zodResolver(planSchema),
    defaultValues: emptyValues,
  });

  const mutation = useMutation({
    mutationFn: async (payload) => {
      if (editing) {
        return api.patch(`/plans/${editing.id}`, payload);
      }
      return api.post('/plans', payload);
    },
    onSuccess: async () => {
      setToast({ tone: 'success', message: editing ? 'Plan updated.' : 'Plan created.' });
      setIsOpen(false);
      form.reset(emptyValues);
      await queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
    onError: (error) => {
      const message = error.response?.data?.error?.message || 'Unable to save plan.';
      setToast({ tone: 'danger', message });
    },
  });

  const actionMutation = useMutation({
    mutationFn: async ({ id, action }) => api.post(`/plans/${id}/${action}`),
    onSuccess: async () => {
      setToast({ tone: 'success', message: 'Plan action completed.' });
      await queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
    onError: (error) => {
      const message = error.response?.data?.error?.message || 'Action not allowed.';
      setToast({ tone: 'danger', message });
    },
  });

  const handleSubmit = (values) => {
    mutation.mutate({
      ...values,
      endDate: values.endDate || null,
    });
  };

  const openCreate = () => {
    setEditing(null);
    form.reset(emptyValues);
    setIsOpen(true);
  };

  const openEdit = (plan) => {
    setEditing(plan);
    form.reset({
      name: plan.name,
      price: plan.price,
      billingPeriod: plan.billingPeriod,
      minQuantity: plan.minQuantity,
      startDate: plan.startDate ? new Date(plan.startDate).toISOString().slice(0, 10) : '',
      endDate: plan.endDate ? new Date(plan.endDate).toISOString().slice(0, 10) : '',
      autoCloseOnEnd: plan.autoCloseOnEnd,
      allowEarlyClose: plan.allowEarlyClose,
      allowPause: plan.allowPause,
      allowRenew: plan.allowRenew,
    });
    setIsOpen(true);
  };

  const getActionState = (plan) => {
    const actions = {
      close: plan.allowEarlyClose ? 'Available' : 'Disable: early close is not enabled',
      pause: plan.allowPause ? 'Available' : 'Disable: pause is not enabled',
      resume: plan.state === 'PAUSED' && plan.allowPause ? 'Available' : 'Disable: only paused plans can resume',
      renew: plan.allowRenew ? 'Available' : 'Disable: renew is not enabled',
    };
    return actions;
  };

  const tableColumns = useMemo(() => [
    { key: 'name', label: 'Plan', render: (row) => (
      <div>
        <div className="font-medium text-slate-900">{row.name}</div>
        <div className="text-xs text-slate-500">{row.billingPeriod}</div>
      </div>
    ) },
    { key: 'price', label: 'Price', render: (row) => `$${Number(row.price || 0).toFixed(2)}` },
    { key: 'minQuantity', label: 'Min', render: (row) => row.minQuantity },
    { key: 'state', label: 'State', render: (row) => {
      const tone = row.state === 'ACTIVE' ? 'success' : row.state === 'PAUSED' ? 'warning' : 'neutral';
      return <Badge tone={tone}>{row.state}</Badge>;
    } },
    { label: 'Actions', render: (row) => (
      <div className="flex flex-wrap gap-2">
        <button type="button" className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100" onClick={() => openEdit(row)}>Edit</button>
        <PlanActionButton plan={row} action="close" label="Close" onPerform={(id) => actionMutation.mutate({ id, action: 'close' })} disabledReason={row.state === 'CLOSED' ? 'Plan is already closed' : getActionState(row).close !== 'Available' ? getActionState(row).close : ''}>
          <XCircle className="h-3.5 w-3.5" />
        </PlanActionButton>
        <PlanActionButton plan={row} action="pause" label={row.state === 'PAUSED' ? 'Paused' : 'Pause'} onPerform={(id) => actionMutation.mutate({ id, action: 'pause' })} disabledReason={row.state === 'PAUSED' || !row.allowPause ? (row.state === 'PAUSED' ? 'Plan is already paused' : 'Pause is not enabled') : ''}>
          <Pause className="h-3.5 w-3.5" />
        </PlanActionButton>
        <PlanActionButton plan={row} action="resume" label="Resume" onPerform={(id) => actionMutation.mutate({ id, action: 'resume' })} disabledReason={row.state !== 'PAUSED' || !row.allowPause ? 'Only paused plans can resume' : ''}>
          <Play className="h-3.5 w-3.5" />
        </PlanActionButton>
        <PlanActionButton plan={row} action="renew" label="Renew" onPerform={(id) => actionMutation.mutate({ id, action: 'renew' })} disabledReason={!row.allowRenew ? 'Renewal is not enabled' : ''}>
          <RotateCcw className="h-3.5 w-3.5" />
        </PlanActionButton>
      </div>
    ) },
  ], [actionMutation]);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Catalog</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Plans</h1>
          </div>
          <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Add plan</Button>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        {isLoading ? <div className="flex justify-center py-10"><Spinner /></div> : isError ? <div className="py-8 text-center text-rose-600">Unable to load plans.</div> : (
          <div className="overflow-x-auto"><div className="min-w-[780px]">{<table className="min-w-full divide-y divide-slate-200"><thead>...</thead></table>}</div></div>
        )}
      </div>

      <Modal open={isOpen} onClose={() => setIsOpen(false)} title={editing ? 'Edit plan' : 'Create plan'}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Input label="Name" {...form.register('name')} error={form.formState.errors.name?.message} />
            </div>
            <Input label="Price" type="number" step="0.01" min="0" {...form.register('price')} error={form.formState.errors.price?.message} />
            <Select label="Billing period" {...form.register('billingPeriod')} options={[{ value: 'DAILY', label: 'Daily' }, { value: 'WEEKLY', label: 'Weekly' }, { value: 'MONTHLY', label: 'Monthly' }, { value: 'YEARLY', label: 'Yearly' }]} error={form.formState.errors.billingPeriod?.message} />
            <Input label="Min quantity" type="number" min="1" {...form.register('minQuantity')} error={form.formState.errors.minQuantity?.message} />
            <Input label="Start date" type="date" {...form.register('startDate')} error={form.formState.errors.startDate?.message} />
            <Input label="End date" type="date" {...form.register('endDate')} error={form.formState.errors.endDate?.message} />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"><input type="checkbox" {...form.register('autoCloseOnEnd')} /> Auto-close at end</label>
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"><input type="checkbox" {...form.register('allowEarlyClose')} /> Allow early close</label>
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"><input type="checkbox" {...form.register('allowPause')} /> Allow pause</label>
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"><input type="checkbox" {...form.register('allowRenew')} /> Allow renew</label>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : editing ? 'Update plan' : 'Create plan'}</Button>
          </div>
        </form>
      </Modal>

      <Toast open={Boolean(toast)} message={toast?.message} tone={toast?.tone || 'info'} />
    </div>
  );
}
