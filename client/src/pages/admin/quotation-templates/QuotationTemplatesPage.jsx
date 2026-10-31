import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import api from '../../../lib/api';
import { Button, Input, Select, Modal, Badge, Toast, Spinner } from '../../../components/ui';

const templateSchema = z.object({
  name: z.string().min(1, 'Template name is required'),
  validityDays: z.coerce.number().int().min(1, 'Validity is required'),
  planId: z.string().min(1, 'Plan is required'),
  notes: z.string().optional().or(z.literal('')),
  lines: z.array(z.object({
    productId: z.string().min(1),
    quantity: z.coerce.number().int().min(1),
  })).default([]),
});

const fetchTemplates = async () => {
  const { data } = await api.get('/quotation-templates');
  return data;
};

const fetchPlans = async () => {
  const { data } = await api.get('/plans?limit=50');
  return data.data || [];
};

const fetchProducts = async () => {
  const { data } = await api.get('/products?limit=100');
  return data.data || [];
};

const emptyValues = {
  name: '',
  validityDays: 30,
  planId: '',
  notes: '',
  lines: [],
};

export function QuotationTemplatesPage() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useState(null);

  const { data: templates = [], isLoading, isError } = useQuery({ queryKey: ['quotation-templates'], queryFn: fetchTemplates });
  const { data: plans = [] } = useQuery({ queryKey: ['plans-select'], queryFn: fetchPlans });
  const { data: products = [] } = useQuery({ queryKey: ['products-select'], queryFn: fetchProducts });

  const form = useForm({ resolver: zodResolver(templateSchema), defaultValues: emptyValues });

  const mutation = useMutation({
    mutationFn: async (payload) => {
      if (editing) return api.patch(`/quotation-templates/${editing.id}`, payload);
      return api.post('/quotation-templates', payload);
    },
    onSuccess: async () => {
      setToast({ tone: 'success', message: editing ? 'Template updated.' : 'Template created.' });
      setIsOpen(false);
      form.reset(emptyValues);
      await queryClient.invalidateQueries({ queryKey: ['quotation-templates'] });
    },
    onError: (error) => {
      const message = error.response?.data?.error?.message || 'Unable to save template.';
      setToast({ tone: 'danger', message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => api.delete(`/quotation-templates/${id}`),
    onSuccess: async () => {
      setToast({ tone: 'success', message: 'Template deleted.' });
      await queryClient.invalidateQueries({ queryKey: ['quotation-templates'] });
    },
    onError: (error) => {
      const message = error.response?.data?.error?.message || 'Unable to delete template.';
      setToast({ tone: 'danger', message });
    },
  });

  const addLine = () => {
    const currentLines = form.getValues('lines') || [];
    form.setValue('lines', [...currentLines, { productId: products[0]?.id || '', quantity: 1 }]);
  };

  const updateLine = (index, field, value) => {
    const next = [...(form.getValues('lines') || [])];
    next[index] = { ...next[index], [field]: value };
    form.setValue('lines', next);
  };

  const removeLine = (index) => {
    form.setValue('lines', (form.getValues('lines') || []).filter((_, itemIndex) => itemIndex !== index));
  };

  const openCreate = () => {
    setEditing(null);
    form.reset(emptyValues);
    setIsOpen(true);
  };

  const openEdit = (template) => {
    setEditing(template);
    form.reset({
      name: template.name,
      validityDays: template.validityDays,
      planId: template.planId,
      notes: template.notes || '',
      lines: (template.lines || []).map((line) => ({ productId: line.productId, quantity: line.quantity || 1 })),
    });
    setIsOpen(true);
  };

  const columns = useMemo(() => [
    { key: 'name', label: 'Template', render: (row) => <div><div className="font-medium text-slate-900">{row.name}</div><div className="text-xs text-slate-500">{row.plan?.name}</div></div> },
    { key: 'validityDays', label: 'Validity', render: (row) => `${row.validityDays} days` },
    { key: 'lines', label: 'Lines', render: (row) => row.lines?.length || 0 },
    { key: 'notes', label: 'Notes', render: (row) => <span className="text-slate-600">{row.notes || '—'}</span> },
    { label: 'Actions', render: (row) => (
      <div className="flex gap-2">
        <button type="button" onClick={() => openEdit(row)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"><Pencil className="h-3.5 w-3.5" /> Edit</button>
        <button type="button" onClick={() => deleteMutation.mutate(row.id)} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
      </div>
    ) },
  ], [deleteMutation]);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Sales</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Quotation templates</h1>
          </div>
          <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Add template</Button>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        {isLoading ? <div className="flex justify-center py-10"><Spinner /></div> : isError ? <div className="py-8 text-center text-rose-600">Unable to load templates.</div> : (
          <div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-200"><thead className="bg-slate-50"><tr>{columns.map((column) => <th key={column.label} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{column.label}</th>)}</tr></thead><tbody>{templates.map((row) => <tr key={row.id}>{columns.map((column) => <td key={`${row.id}-${column.label}`} className="px-4 py-3 text-sm text-slate-700">{column.render ? column.render(row) : row[column.key]}</td>)}</tr>)}</tbody></table></div>
        )}
      </div>

      <Modal open={isOpen} onClose={() => setIsOpen(false)} title={editing ? 'Edit template' : 'Create template'}>
        <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2"><Input label="Template name" {...form.register('name')} error={form.formState.errors.name?.message} /></div>
            <Input label="Validity days" type="number" min="1" {...form.register('validityDays')} error={form.formState.errors.validityDays?.message} />
            <Select label="Plan" {...form.register('planId')} options={[{ value: '', label: 'Select plan' }, ...plans.map((plan) => ({ value: plan.id, label: plan.name }))]} error={form.formState.errors.planId?.message} />
            <div className="md:col-span-2"><Input label="Notes" {...form.register('notes')} error={form.formState.errors.notes?.message} /></div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Template lines</h3>
              <Button type="button" variant="secondary" onClick={addLine}>Add line</Button>
            </div>

            {(form.watch('lines') || []).length === 0 ? (
              <p className="text-sm text-slate-500">No lines added yet.</p>
            ) : (
              <div className="space-y-3">
                {(form.watch('lines') || []).map((line, index) => (
                  <div key={`${line.productId || 'line'}-${index}`} className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[1fr_110px_auto]">
                    <Select
                      value={line.productId}
                      onChange={(event) => updateLine(index, 'productId', event.target.value)}
                      options={[{ value: '', label: 'Select product' }, ...products.map((product) => ({ value: product.id, label: product.name }))]}
                    />
                    <Input type="number" min="1" value={line.quantity} onChange={(event) => updateLine(index, 'quantity', Number(event.target.value || 1))} />
                    <button type="button" onClick={() => removeLine(index)} className="text-rose-600 hover:text-rose-500">Remove</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : editing ? 'Update template' : 'Create template'}</Button>
          </div>
        </form>
      </Modal>

      <Toast open={Boolean(toast)} message={toast?.message} tone={toast?.tone || 'info'} />
    </div>
  );
}
