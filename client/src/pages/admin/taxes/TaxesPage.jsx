import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import api from '../../../lib/api';
import { Button, Input, Select, Modal, Badge, Toast, Spinner } from '../../../components/ui';

const taxSchema = z.object({
  name: z.string().min(1, 'Tax name is required'),
  ratePercent: z.coerce.number().min(0, 'Rate must be >= 0').max(100, 'Rate must be <= 100'),
  appliesToProductType: z.enum(['SERVICE', 'SOFTWARE', 'ADDON', 'PHYSICAL', '']).optional().or(z.literal('')),
  isActive: z.boolean().default(true),
});

const fetchTaxes = async () => {
  const { data } = await api.get('/taxes');
  return data;
};

const emptyValues = {
  name: '',
  ratePercent: 0,
  appliesToProductType: '',
  isActive: true,
};

export function TaxesPage() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useState(null);

  const { data: taxes = [], isLoading, isError } = useQuery({ queryKey: ['taxes'], queryFn: fetchTaxes });
  const form = useForm({ resolver: zodResolver(taxSchema), defaultValues: emptyValues });

  const mutation = useMutation({
    mutationFn: async (payload) => {
      const normalized = {
        ...payload,
        appliesToProductType: payload.appliesToProductType || null,
      };
      if (editing) return api.patch(`/taxes/${editing.id}`, normalized);
      return api.post('/taxes', normalized);
    },
    onSuccess: async () => {
      setToast({ tone: 'success', message: editing ? 'Tax updated.' : 'Tax created.' });
      setIsOpen(false);
      form.reset(emptyValues);
      await queryClient.invalidateQueries({ queryKey: ['taxes'] });
    },
    onError: (error) => {
      const message = error.response?.data?.error?.message || 'Unable to save tax.';
      setToast({ tone: 'danger', message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => api.delete(`/taxes/${id}`),
    onSuccess: async () => {
      setToast({ tone: 'success', message: 'Tax deactivated.' });
      await queryClient.invalidateQueries({ queryKey: ['taxes'] });
    },
    onError: (error) => {
      const message = error.response?.data?.error?.message || 'Unable to delete tax.';
      setToast({ tone: 'danger', message });
    },
  });

  const openCreate = () => {
    setEditing(null);
    form.reset(emptyValues);
    setIsOpen(true);
  };

  const openEdit = (tax) => {
    setEditing(tax);
    form.reset({
      name: tax.name,
      ratePercent: tax.ratePercent,
      appliesToProductType: tax.appliesToProductType || '',
      isActive: tax.isActive,
    });
    setIsOpen(true);
  };

  const columns = useMemo(() => [
    { key: 'name', label: 'Tax', render: (row) => <div className="font-medium text-slate-900">{row.name}</div> },
    { key: 'ratePercent', label: 'Rate', render: (row) => `${Number(row.ratePercent).toFixed(2)}%` },
    { key: 'appliesToProductType', label: 'Applies to', render: (row) => row.appliesToProductType || 'All' },
    { key: 'isActive', label: 'Status', render: (row) => <Badge tone={row.isActive ? 'success' : 'neutral'}>{row.isActive ? 'Active' : 'Inactive'}</Badge> },
    { label: 'Actions', render: (row) => (
      <div className="flex gap-2">
        <button type="button" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100" onClick={() => openEdit(row)}><Pencil className="h-3.5 w-3.5" /> Edit</button>
        <button type="button" className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50" onClick={() => deleteMutation.mutate(row.id)}><Trash2 className="h-3.5 w-3.5" /> Deactivate</button>
      </div>
    ) },
  ], [deleteMutation]);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Tax rules</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Taxes</h1>
          </div>
          <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Add tax</Button>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        {isLoading ? <div className="flex justify-center py-10"><Spinner /></div> : isError ? <div className="py-8 text-center text-rose-600">Unable to load taxes.</div> : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>{columns.map((column) => <th key={column.label} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{column.label}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {taxes.map((row) => (
                  <tr key={row.id}>
                    {columns.map((column) => (
                      <td key={`${row.id}-${column.label}`} className="px-4 py-3 text-sm text-slate-700">{column.render ? column.render(row) : row[column.key]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={isOpen} onClose={() => setIsOpen(false)} title={editing ? 'Edit tax' : 'Create tax'}>
        <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="space-y-4">
          <Input label="Name" {...form.register('name')} error={form.formState.errors.name?.message} />
          <Input label="Rate (%)" type="number" step="0.01" min="0" max="100" {...form.register('ratePercent')} error={form.formState.errors.ratePercent?.message} />
          <Select label="Applies to" {...form.register('appliesToProductType')} options={[{ value: '', label: 'All product types' }, { value: 'SERVICE', label: 'Service' }, { value: 'SOFTWARE', label: 'Software' }, { value: 'ADDON', label: 'Addon' }, { value: 'PHYSICAL', label: 'Physical' }]} error={form.formState.errors.appliesToProductType?.message} />
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"><input type="checkbox" {...form.register('isActive')} /> Active</label>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : editing ? 'Update tax' : 'Create tax'}</Button>
          </div>
        </form>
      </Modal>

      <Toast open={Boolean(toast)} message={toast?.message} tone={toast?.tone || 'info'} />
    </div>
  );
}
