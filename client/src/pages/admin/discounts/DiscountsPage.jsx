import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2, CircleSlash } from 'lucide-react';
import api from '../../../lib/api';
import { Button, Input, Select, Modal, Badge, Toast, Spinner } from '../../../components/ui';

const discountSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['FIXED', 'PERCENTAGE']),
  value: z.coerce.number().min(0, 'Value must be >= 0'),
  scope: z.enum(['PRODUCT', 'SUBSCRIPTION']),
  minPurchaseAmount: z.coerce.number().min(0).optional().or(z.literal('')),
  minQuantity: z.coerce.number().int().min(1).optional().or(z.literal('')),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().optional().or(z.literal('')),
  usageLimit: z.coerce.number().int().min(1).optional().or(z.literal('')),
  productIds: z.array(z.string()).default([]),
  subscriptionIds: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
});

const fetchDiscounts = async () => {
  const { data } = await api.get('/discounts');
  return data;
};

const emptyValues = {
  name: '',
  type: 'PERCENTAGE',
  value: 10,
  scope: 'PRODUCT',
  minPurchaseAmount: '',
  minQuantity: '',
  startDate: new Date().toISOString().slice(0, 10),
  endDate: '',
  usageLimit: '',
  productIds: [],
  subscriptionIds: [],
  isActive: true,
};

export function DiscountsPage() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useState(null);

  const { data: discounts = [], isLoading, isError } = useQuery({ queryKey: ['discounts'], queryFn: fetchDiscounts });
  const form = useForm({ resolver: zodResolver(discountSchema), defaultValues: emptyValues });

  const mutation = useMutation({
    mutationFn: async (payload) => {
      const normalized = {
        ...payload,
        minPurchaseAmount: payload.minPurchaseAmount || null,
        minQuantity: payload.minQuantity || null,
        endDate: payload.endDate || null,
        usageLimit: payload.usageLimit || null,
      };
      if (editing) return api.patch(`/discounts/${editing.id}`, normalized);
      return api.post('/discounts', normalized);
    },
    onSuccess: async () => {
      setToast({ tone: 'success', message: editing ? 'Discount updated.' : 'Discount created.' });
      setIsOpen(false);
      form.reset(emptyValues);
      await queryClient.invalidateQueries({ queryKey: ['discounts'] });
    },
    onError: (error) => {
      const message = error.response?.data?.error?.message || 'Unable to save discount.';
      setToast({ tone: 'danger', message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => api.delete(`/discounts/${id}`),
    onSuccess: async () => {
      setToast({ tone: 'success', message: 'Discount deactivated.' });
      await queryClient.invalidateQueries({ queryKey: ['discounts'] });
    },
    onError: (error) => {
      const message = error.response?.data?.error?.message || 'Unable to deactivate discount.';
      setToast({ tone: 'danger', message });
    },
  });

  const openCreate = () => {
    setEditing(null);
    form.reset(emptyValues);
    setIsOpen(true);
  };

  const openEdit = (discount) => {
    setEditing(discount);
    form.reset({
      name: discount.name,
      type: discount.type,
      value: discount.value,
      scope: discount.scope,
      minPurchaseAmount: discount.minPurchaseAmount ?? '',
      minQuantity: discount.minQuantity ?? '',
      startDate: discount.startDate ? new Date(discount.startDate).toISOString().slice(0, 10) : '',
      endDate: discount.endDate ? new Date(discount.endDate).toISOString().slice(0, 10) : '',
      usageLimit: discount.usageLimit ?? '',
      productIds: discount.products?.map((item) => item.productId) || [],
      subscriptionIds: discount.subscriptions?.map((item) => item.subscriptionId) || [],
      isActive: discount.isActive,
    });
    setIsOpen(true);
  };

  const getDiscountBadge = (discount) => {
    const now = new Date();
    const startDate = new Date(discount.startDate);
    const endDate = discount.endDate ? new Date(discount.endDate) : null;
    if (endDate && endDate < now) return { tone: 'neutral', label: 'Expired' };
    if (discount.usageLimit && discount.usedCount >= discount.usageLimit) return { tone: 'warning', label: 'Exhausted' };
    return { tone: 'success', label: 'Active' };
  };

  const columns = useMemo(() => [
    { key: 'name', label: 'Name', render: (row) => <div className="font-medium text-slate-900">{row.name}</div> },
    { key: 'type', label: 'Type', render: (row) => row.type === 'PERCENTAGE' ? `${row.value}%` : `$${row.value}` },
    { key: 'scope', label: 'Scope', render: (row) => row.scope },
    { key: 'usageLimit', label: 'Usage', render: (row) => {
      const used = row.usageUsed ?? 0;
      const limit = row.usageLimit || 0;
      const percent = limit ? Math.min(100, (used / limit) * 100) : 0;
      return (
        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-slate-500"><span>{used}</span><span>{limit || '∞'}</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${percent}%` }} /></div>
        </div>
      );
    } },
    { key: 'status', label: 'Status', render: (row) => {
      const badge = getDiscountBadge(row);
      return <Badge tone={badge.tone}>{badge.label}</Badge>;
    } },
    { label: 'Actions', render: (row) => (
      <div className="flex gap-2">
        <button type="button" onClick={() => openEdit(row)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"><Pencil className="h-3.5 w-3.5" /> Edit</button>
        <button type="button" onClick={() => deleteMutation.mutate(row.id)} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" /> Deactivate</button>
      </div>
    ) },
  ], [deleteMutation]);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Promotions</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Discounts</h1>
          </div>
          <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Add discount</Button>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        {isLoading ? <div className="flex justify-center py-10"><Spinner /></div> : isError ? <div className="py-8 text-center text-rose-600">Unable to load discounts.</div> : (
          <div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-200"><thead className="bg-slate-50"><tr>{columns.map((column) => <th key={column.label} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{column.label}</th>)}</tr></thead><tbody>{discounts.map((row) => <tr key={row.id}>{columns.map((column) => <td key={`${row.id}-${column.label}`} className="px-4 py-3 text-sm text-slate-700">{column.render ? column.render(row) : row[column.key]}</td>)}</tr>)}</tbody></table></div>
        )}
      </div>

      <Modal open={isOpen} onClose={() => setIsOpen(false)} title={editing ? 'Edit discount' : 'Create discount'}>
        <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2"><Input label="Name" {...form.register('name')} error={form.formState.errors.name?.message} /></div>
            <Select label="Type" {...form.register('type')} options={[{ value: 'FIXED', label: 'Fixed' }, { value: 'PERCENTAGE', label: 'Percentage' }]} error={form.formState.errors.type?.message} />
            <Input label="Value" type="number" step="0.01" min="0" {...form.register('value')} error={form.formState.errors.value?.message} />
            <Select label="Scope" {...form.register('scope')} options={[{ value: 'PRODUCT', label: 'Specific products' }, { value: 'SUBSCRIPTION', label: 'Subscriptions' }]} error={form.formState.errors.scope?.message} />
            <Input label="Minimum purchase" type="number" step="0.01" min="0" {...form.register('minPurchaseAmount')} error={form.formState.errors.minPurchaseAmount?.message} />
            <Input label="Minimum quantity" type="number" min="1" {...form.register('minQuantity')} error={form.formState.errors.minQuantity?.message} />
            <Input label="Start date" type="date" {...form.register('startDate')} error={form.formState.errors.startDate?.message} />
            <Input label="End date" type="date" {...form.register('endDate')} error={form.formState.errors.endDate?.message} />
            <Input label="Usage limit" type="number" min="1" {...form.register('usageLimit')} error={form.formState.errors.usageLimit?.message} />
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"><input type="checkbox" {...form.register('isActive')} /> Active</label>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : editing ? 'Update discount' : 'Create discount'}</Button>
          </div>
        </form>
      </Modal>

      <Toast open={Boolean(toast)} message={toast?.message} tone={toast?.tone || 'info'} />
    </div>
  );
}
