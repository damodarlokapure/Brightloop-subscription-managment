import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Search, Trash2, Pencil, Percent } from 'lucide-react';
import api from '../../../lib/api';
import { Button, Input, Select, Table, Badge, SearchInput, FilterBar, Modal, Toast, Spinner } from '../../../components/ui';

const productSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['SERVICE', 'SOFTWARE', 'ADDON', 'PHYSICAL']),
  salesPrice: z.coerce.number().min(0, 'Sales price is required'),
  costPrice: z.coerce.number().min(0, 'Cost price is required'),
  notes: z.string().optional().or(z.literal('')),
  defaultTaxId: z.string().optional().or(z.literal('')),
  variants: z.array(z.object({
    attribute: z.string().min(1, 'Attribute is required'),
    value: z.string().min(1, 'Value is required'),
    extraPrice: z.coerce.number().min(0, 'Extra price must be >= 0'),
  })).default([]),
});

const fetchProducts = async ({ page = 1, search = '', type = 'ALL' } = {}) => {
  const params = new URLSearchParams({ page, limit: 10 });
  if (search) params.set('search', search);
  if (type && type !== 'ALL') params.set('type', type);
  const { data } = await api.get(`/products?${params.toString()}`);
  return data;
};

const fetchTaxes = async () => {
  const { data } = await api.get('/taxes');
  return data;
};

const emptyForm = {
  name: '',
  type: 'SERVICE',
  salesPrice: 0,
  costPrice: 0,
  notes: '',
  defaultTaxId: '',
  variants: [],
};

function ProductVariantEditor({ control, register, setValue, watch }) {
  const variants = watch('variants') || [];

  const addVariant = () => {
    setValue('variants', [...variants, { attribute: '', value: '', extraPrice: 0 }]);
  };

  const updateVariant = (index, field, value) => {
    const next = [...variants];
    next[index] = { ...next[index], [field]: value };
    setValue('variants', next);
  };

  const removeVariant = (index) => {
    setValue('variants', variants.filter((_, itemIndex) => itemIndex !== index));
  };

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Variants</h3>
        <Button type="button" variant="secondary" onClick={addVariant}>Add row</Button>
      </div>

      {variants.length === 0 ? (
        <p className="text-sm text-slate-500">No variants configured. Add options such as size, brand, or package.</p>
      ) : (
        <div className="space-y-3">
          {variants.map((variant, index) => (
            <div key={`${variant.attribute}-${index}`} className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[1fr_1fr_140px_auto]">
              <input
                value={variant.attribute}
                onChange={(event) => updateVariant(index, 'attribute', event.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                placeholder="Attribute"
              />
              <input
                value={variant.value}
                onChange={(event) => updateVariant(index, 'value', event.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                placeholder="Value"
              />
              <input
                type="number"
                min="0"
                step="0.01"
                value={variant.extraPrice}
                onChange={(event) => updateVariant(index, 'extraPrice', Number(event.target.value || 0))}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                placeholder="+ price"
              />
              <button type="button" className="text-rose-600 hover:text-rose-500" onClick={() => removeVariant(index)}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {variants.length > 0 ? (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-700">
          <div className="font-medium">Effective price preview</div>
          {variants.map((variant, index) => (
            <div key={`preview-${index}`} className="mt-1">
              {variant.attribute || 'Attribute'} = {variant.value || 'Value'} +{Number(variant.extraPrice || 0).toFixed(2)}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ProductsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useState(null);

  const { data: taxes = [] } = useQuery({ queryKey: ['taxes'], queryFn: fetchTaxes });
  const { data: productsData, isLoading, isError } = useQuery({
    queryKey: ['products', { page, search, typeFilter }],
    queryFn: () => fetchProducts({ page, search, type: typeFilter }),
  });

  const form = useForm({
    defaultValues: emptyForm,
    resolver: zodResolver(productSchema),
  });

  const productRows = productsData?.data || [];
  const totalPages = productsData?.totalPages || 1;

  const openCreate = () => {
    setEditing(null);
    form.reset(emptyForm);
    setIsOpen(true);
  };

  const openEdit = (product) => {
    setEditing(product);
    form.reset({
      name: product.name,
      type: product.type,
      salesPrice: product.salesPrice,
      costPrice: product.costPrice,
      notes: product.notes || '',
      defaultTaxId: product.tax?.id || '',
      variants: (product.variants || []).map((variant) => ({
        attribute: variant.attribute,
        value: variant.value,
        extraPrice: variant.extraPrice,
      })),
    });
    setIsOpen(true);
  };

  const mutation = useMutation({
    mutationFn: async (payload) => {
      if (editing) {
        return api.patch(`/products/${editing.id}`, payload);
      }
      return api.post('/products', payload);
    },
    onSuccess: async () => {
      setToast({ tone: 'success', message: editing ? 'Product updated.' : 'Product created.' });
      setIsOpen(false);
      form.reset(emptyForm);
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      await queryClient.invalidateQueries({ queryKey: ['taxes'] });
    },
    onError: (error) => {
      const message = error.response?.data?.error?.message || 'Unable to save product.';
      setToast({ tone: 'danger', message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => api.delete(`/products/${id}`),
    onSuccess: async () => {
      setToast({ tone: 'success', message: 'Product deleted.' });
      await queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (error) => {
      const message = error.response?.data?.error?.message || 'Unable to delete product.';
      setToast({ tone: 'danger', message });
    },
  });

  const onSubmit = (values) => mutation.mutate({ ...values, defaultTaxId: values.defaultTaxId || null });

  const tableColumns = useMemo(() => [
    { key: 'name', label: 'Product', render: (row) => (
      <div>
        <div className="font-medium text-slate-900">{row.name}</div>
        <div className="text-xs text-slate-500">{row.type}</div>
      </div>
    ) },
    { key: 'salesPrice', label: 'Sales price', render: (row) => `$${Number(row.salesPrice || 0).toFixed(2)}` },
    { key: 'costPrice', label: 'Cost price', render: (row) => `$${Number(row.costPrice || 0).toFixed(2)}` },
    { key: 'variants', label: 'Variants', render: (row) => <span className="text-slate-600">{row._count?.variants ?? row.variants?.length ?? 0}</span> },
    { key: 'tax', label: 'Tax', render: (row) => row.tax ? <Badge tone="info">{row.tax.name}</Badge> : <Badge tone="neutral">No tax</Badge> },
    { label: 'Actions', render: (row) => (
      <div className="flex items-center gap-2">
        <button type="button" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100" onClick={() => openEdit(row)}>
          <Pencil className="h-3.5 w-3.5" /> Edit
        </button>
        <button type="button" className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50" onClick={() => deleteMutation.mutate(row.id)}>
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </button>
      </div>
    ) },
  ], [deleteMutation]);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Catalog</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Products</h1>
          </div>
          <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Add product</Button>
        </div>

        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex-1">
            <SearchInput value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="Search products" />
          </div>
          <div className="w-full md:w-52">
            <Select
              value={typeFilter}
              onChange={(event) => { setTypeFilter(event.target.value); setPage(1); }}
              options={[{ value: 'ALL', label: 'All types' }, { value: 'SERVICE', label: 'Service' }, { value: 'SOFTWARE', label: 'Software' }, { value: 'ADDON', label: 'Addon' }, { value: 'PHYSICAL', label: 'Physical' }]}
            />
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        {isLoading ? <div className="flex justify-center py-10"><Spinner /></div> : isError ? <div className="py-8 text-center text-rose-600">Unable to load products.</div> : (
          <Table columns={tableColumns} rows={productRows} emptyMessage="No products found." />
        )}
      </div>

      <div className="flex justify-end">
        <Button variant="secondary" onClick={() => setPage((pageNumber) => Math.max(1, pageNumber - 1))} disabled={page <= 1}>Previous</Button>
        <span className="mx-3 self-center text-sm text-slate-600">Page {page} / {totalPages}</span>
        <Button variant="secondary" onClick={() => setPage((pageNumber) => Math.min(totalPages, pageNumber + 1))} disabled={page >= totalPages}>Next</Button>
      </div>

      <Modal open={isOpen} onClose={() => setIsOpen(false)} title={editing ? 'Edit product' : 'Create product'}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Input label="Product name" {...form.register('name')} error={form.formState.errors.name?.message} />
            </div>
            <Select label="Type" {...form.register('type')} options={[{ value: 'SERVICE', label: 'Service' }, { value: 'SOFTWARE', label: 'Software' }, { value: 'ADDON', label: 'Addon' }, { value: 'PHYSICAL', label: 'Physical' }]} error={form.formState.errors.type?.message} />
            <Select label="Default tax" {...form.register('defaultTaxId')} options={[{ value: '', label: 'No tax' }, ...taxes.map((tax) => ({ value: tax.id, label: `${tax.name} (${tax.ratePercent}%)` }))]} error={form.formState.errors.defaultTaxId?.message} />
            <Input label="Sales price" type="number" step="0.01" min="0" {...form.register('salesPrice')} error={form.formState.errors.salesPrice?.message} />
            <Input label="Cost price" type="number" step="0.01" min="0" {...form.register('costPrice')} error={form.formState.errors.costPrice?.message} />
            <div className="md:col-span-2">
              <Input label="Notes" {...form.register('notes')} error={form.formState.errors.notes?.message} />
            </div>
            <div className="md:col-span-2">
              <ProductVariantEditor control={form.control} register={form.register} setValue={form.setValue} watch={form.watch} />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : editing ? 'Update product' : 'Create product'}
            </Button>
          </div>
        </form>
      </Modal>

      <Toast open={Boolean(toast)} message={toast?.message} tone={toast?.tone || 'info'} />
    </div>
  );
}
