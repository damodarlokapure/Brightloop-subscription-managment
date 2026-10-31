import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, FileText, CalendarRange } from 'lucide-react';
import { Button, Input, Modal, Select, Badge, Toast } from '../../../components/ui';
import { customerRecords, productCatalog, planCatalog, templates } from './seedData';

const quoteSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  planId: z.string().min(1, 'Plan is required'),
  startDate: z.string().min(1, 'Start date is required'),
  expiryDate: z.string().optional().or(z.literal('')),
  paymentTerms: z.coerce.number().int().min(0).default(0),
  validityDays: z.coerce.number().int().min(1).default(30),
  templateId: z.string().optional().or(z.literal('')),
  lines: z.array(z.object({
    productId: z.string().min(1),
    variant: z.string().optional().or(z.literal('')),
    quantity: z.coerce.number().int().min(1).default(1),
    unitPrice: z.coerce.number().min(0).default(0),
    taxRate: z.coerce.number().min(0).default(0),
  })).default([]),
});

const loadTemplates = async () => templates;
const loadPlans = async () => planCatalog;
const loadCustomers = async () => customerRecords;
const loadProducts = async () => productCatalog;

function buildLine(productId, baseQuantity = 1) {
  const product = productCatalog.find((entry) => entry.id === productId) || productCatalog[0];
  return { productId, variant: '', quantity: baseQuantity, unitPrice: product.unitPrice, taxRate: product.taxRate };
}

export function QuotationsPage() {
  const [isOpen, setIsOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const { data: customers = [] } = useQuery({ queryKey: ['customers-select'], queryFn: loadCustomers });
  const { data: plans = [] } = useQuery({ queryKey: ['plans-select'], queryFn: loadPlans });
  const { data: products = [] } = useQuery({ queryKey: ['products-select'], queryFn: loadProducts });
  const { data: templateOptions = [] } = useQuery({ queryKey: ['templates'], queryFn: loadTemplates });

  const form = useForm({
    resolver: zodResolver(quoteSchema),
    defaultValues: {
      customerId: '',
      planId: '',
      startDate: new Date().toISOString().slice(0, 10),
      expiryDate: '',
      paymentTerms: 14,
      validityDays: 30,
      templateId: '',
      lines: [buildLine(productCatalog[0].id, 1)],
    },
  });

  const watchLines = form.watch('lines') || [];
  const subtotal = watchLines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unitPrice || 0), 0);
  const taxTotal = watchLines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unitPrice || 0) * (Number(line.taxRate || 0) / 100), 0);
  const total = subtotal + taxTotal;

  const applyTemplate = (templateId) => {
    const template = templateOptions.find((entry) => entry.id === templateId);
    if (!template) return;
    form.setValue('planId', template.planId);
    form.setValue('validityDays', template.validityDays);
    form.setValue('lines', template.lines.map((line) => ({
      productId: line.productId,
      variant: '',
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      taxRate: line.taxRate,
    })));
  };

  const updateLine = (index, field, value) => {
    const next = [...watchLines];
    next[index] = { ...next[index], [field]: value };
    form.setValue('lines', next);
  };

  const addLine = () => {
    form.setValue('lines', [...watchLines, buildLine(products[0]?.id || productCatalog[0].id, 1)]);
  };

  const removeLine = (index) => form.setValue('lines', watchLines.filter((_, itemIndex) => itemIndex !== index));

  const onSubmit = (values) => {
    setToast({ tone: 'success', message: `Quotation ready for ${customers.find((cust) => cust.id === values.customerId)?.name || 'customer'}.` });
    setIsOpen(false);
  };

  const quoteRows = useMemo(() => [
    { id: 'q-1', customer: 'Ava Patel', plan: 'Startup', status: 'Draft' },
    { id: 'q-2', customer: 'Marcus Chen', plan: 'Growth', status: 'Sent' },
  ], []);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Sales</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Quotations</h1>
          </div>
          <Button onClick={() => setIsOpen(true)}><Plus className="mr-2 h-4 w-4" /> New quotation</Button>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50"><tr><th className="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-slate-500">Customer</th><th className="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-slate-500">Plan</th><th className="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-slate-500">Status</th></tr></thead>
            <tbody>{quoteRows.map((row) => <tr key={row.id}><td className="px-4 py-3 text-sm text-slate-700">{row.customer}</td><td className="px-4 py-3 text-sm text-slate-700">{row.plan}</td><td className="px-4 py-3 text-sm"><Badge tone="neutral">{row.status}</Badge></td></tr>)}</tbody>
          </table>
        </div>
      </div>

      <Modal open={isOpen} onClose={() => setIsOpen(false)} title="New quotation">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Select label="Template" value={form.watch('templateId')} onChange={(event) => { form.setValue('templateId', event.target.value); if (event.target.value) applyTemplate(event.target.value); }} options={[{ value: '', label: 'Start from scratch' }, ...templateOptions.map((template) => ({ value: template.id, label: template.name }))]} />
            <Select label="Customer" {...form.register('customerId')} options={[{ value: '', label: 'Select customer' }, ...customers.map((customer) => ({ value: customer.id, label: customer.name }))]} error={form.formState.errors.customerId?.message} />
            <Select label="Plan" {...form.register('planId')} options={[{ value: '', label: 'Select plan' }, ...plans.map((plan) => ({ value: plan.id, label: plan.name }))]} error={form.formState.errors.planId?.message} />
            <Input label="Validity days" type="number" {...form.register('validityDays')} error={form.formState.errors.validityDays?.message} />
            <Input label="Start date" type="date" {...form.register('startDate')} error={form.formState.errors.startDate?.message} />
            <Input label="Expiry date" type="date" {...form.register('expiryDate')} error={form.formState.errors.expiryDate?.message} />
            <Input label="Payment terms (days)" type="number" {...form.register('paymentTerms')} error={form.formState.errors.paymentTerms?.message} />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Lines</h3>
              <Button type="button" variant="secondary" onClick={addLine}>Add line</Button>
            </div>
            <div className="space-y-3">
              {watchLines.map((line, index) => (
                <div key={`${line.productId}-${index}`} className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_0.8fr_auto]">
                  <Select value={line.productId} onChange={(event) => updateLine(index, 'productId', event.target.value)} options={[{ value: '', label: 'Select product' }, ...products.map((product) => ({ value: product.id, label: product.name }))]} />
                  <Input type="text" value={line.variant} onChange={(event) => updateLine(index, 'variant', event.target.value)} placeholder="Variant" />
                  <Input type="number" min="1" value={line.quantity} onChange={(event) => updateLine(index, 'quantity', Number(event.target.value || 1))} />
                  <Input type="number" step="0.01" value={line.unitPrice} onChange={(event) => updateLine(index, 'unitPrice', Number(event.target.value || 0))} />
                  <Input type="number" step="0.01" value={line.taxRate} onChange={(event) => updateLine(index, 'taxRate', Number(event.target.value || 0))} />
                  <button type="button" className="self-center text-rose-600 hover:text-rose-500" onClick={() => removeLine(index)}>Remove</button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between text-sm text-slate-600"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
            <div className="mt-2 flex items-center justify-between text-sm text-slate-600"><span>Tax</span><span>${taxTotal.toFixed(2)}</span></div>
            <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-2 text-base font-semibold text-slate-900"><span>Total</span><span>${total.toFixed(2)}</span></div>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button type="submit">Save quotation</Button>
          </div>
        </form>
      </Modal>

      <Toast open={Boolean(toast)} message={toast?.message} tone={toast?.tone || 'info'} />
    </div>
  );
}
