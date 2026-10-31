import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Pencil, ArrowLeft, Briefcase, Mail, Phone, Building2 } from 'lucide-react';
import { Button, Input, Modal, Badge, Toast, ConfirmDialog } from '../../../components/ui';
import { useAuth } from '../../../contexts/AuthContext';
import { customerRecords, subscriptionRecords, invoiceRecords, paymentRecords } from './seedData';

const formSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Valid email is required'),
  company: z.string().min(1, 'Company is required'),
  phone: z.string().optional().or(z.literal('')),
  city: z.string().optional().or(z.literal('')),
  country: z.string().optional().or(z.literal('')),
});

const getCustomers = async () => customerRecords;

export function CustomersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  const { data: customers = [], isLoading } = useQuery({ queryKey: ['customers'], queryFn: getCustomers });
  const form = useForm({ resolver: zodResolver(formSchema), defaultValues: { name: '', email: '', company: '', phone: '', city: '', country: '' } });

  const createMutation = useMutation({
    mutationFn: async (values) => values,
    onSuccess: async (_, payload) => {
      const nextCustomer = { id: editing?.id || `cust-${Date.now()}`, ...payload };
      const existing = queryClient.getQueryData(['customers']) || [];
      queryClient.setQueryData(['customers'], editing ? existing.map((item) => item.id === editing.id ? { ...item, ...payload } : item) : [...existing, nextCustomer]);
      setToast({ tone: 'success', message: editing ? 'Customer updated.' : 'Customer created.' });
      setIsOpen(false);
      form.reset();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => deleteId,
    onSuccess: async () => {
      const list = queryClient.getQueryData(['customers']) || [];
      queryClient.setQueryData(['customers'], list.filter((item) => item.id !== deleteId));
      setDeleteId(null);
      setToast({ tone: 'success', message: 'Customer removed from the list.' });
    },
  });

  const openCreate = () => {
    setEditing(null);
    form.reset({ name: '', email: '', company: '', phone: '', city: '', country: '' });
    setIsOpen(true);
  };

  const openEdit = (customer) => {
    setEditing(customer);
    form.reset({ name: customer.name, email: customer.email, company: customer.company, phone: customer.phone || '', city: customer.city || '', country: customer.country || '' });
    setIsOpen(true);
  };

  const tableColumns = useMemo(() => [
    { label: 'Customer', render: (row) => <div><div className="font-medium text-slate-900">{row.name}</div><div className="text-xs text-slate-500">{row.company}</div></div> },
    { label: 'Email', render: (row) => row.email },
    { label: 'Location', render: (row) => row.city ? `${row.city}, ${row.country || ''}` : '—' },
    { label: 'Subscriptions', render: (row) => subscriptionRecords.filter((sub) => sub.customerId === row.id).length },
    { label: 'Actions', render: (row) => (
      <div className="flex gap-2">
        <button type="button" className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100" onClick={() => navigate(`/admin/customers/${row.id}`)}>View</button>
        {isAdmin && (
          <>
            <button type="button" className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100" onClick={() => openEdit(row)}><Pencil className="mr-1 inline-block h-3 w-3" />Edit</button>
            <button type="button" className="rounded-lg border border-rose-200 bg-white px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50" onClick={() => setDeleteId(row.id)}>Delete</button>
          </>
        )}
      </div>
    ) },
  ], [navigate, isAdmin]);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Accounts</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Customers</h1>
          </div>
          {isAdmin && (
            <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> New customer</Button>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        {isLoading ? <div className="py-10 text-center text-slate-500">Loading customers…</div> : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50"><tr>{tableColumns.map((column) => <th key={column.label} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{column.label}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-200 bg-white">{customers.map((row) => <tr key={row.id}>{tableColumns.map((column) => <td key={`${row.id}-${column.label}`} className="px-4 py-3 text-sm text-slate-700">{column.render(row)}</td>)}</tr>)}</tbody>
            </table>
          </div>
        )}
      </div>

      {isAdmin && (
        <Modal open={isOpen} onClose={() => setIsOpen(false)} title={editing ? 'Edit customer' : 'Create customer'}>
          <form onSubmit={form.handleSubmit((values) => createMutation.mutate(values))} className="space-y-4">
            <Input label="Name" {...form.register('name')} error={form.formState.errors.name?.message} />
            <Input label="Email" type="email" {...form.register('email')} error={form.formState.errors.email?.message} />
            <Input label="Company" {...form.register('company')} error={form.formState.errors.company?.message} />
            <Input label="Phone" {...form.register('phone')} error={form.formState.errors.phone?.message} />
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="City" {...form.register('city')} error={form.formState.errors.city?.message} />
              <Input label="Country" {...form.register('country')} error={form.formState.errors.country?.message} />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setIsOpen(false)}>Cancel</Button>
              <Button type="submit">{editing ? 'Update customer' : 'Create customer'}</Button>
            </div>
          </form>
        </Modal>
      )}

      {isAdmin && (
        <ConfirmDialog open={Boolean(deleteId)} title="Delete customer" description="This removes the customer from the list. This action is for demo purposes only." confirmLabel="Delete" onConfirm={() => deleteMutation.mutate()} onCancel={() => setDeleteId(null)} />
      )}
      <Toast open={Boolean(toast)} message={toast?.message} tone={toast?.tone || 'info'} />
    </div>
  );
}

export function CustomerDetailPage() {
  const navigate = useNavigate();
  const { customerId } = useParams();
  const customer = customerRecords.find((entry) => entry.id === customerId);

  if (!customer) {
    return <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-600">Customer not found.</div>;
  }

  const relatedSubscriptions = subscriptionRecords.filter((sub) => sub.customerId === customer.id);
  const relatedInvoices = invoiceRecords.filter((invoice) => invoice.customerId === customer.id);
  const relatedPayments = paymentRecords.filter((payment) => payment.invoice.customerId === customer.id);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3"><Button variant="secondary" onClick={() => navigate(-1)}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button></div>
        <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Customer overview</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">{customer.name}</h1>
          </div>
          <Badge tone="info">{customer.company}</Badge>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><Building2 className="mb-2 h-5 w-5 text-indigo-600" /><div className="text-xs uppercase tracking-[0.14em] text-slate-500">Company</div><div className="mt-2 font-semibold text-slate-900">{customer.company}</div></div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><Mail className="mb-2 h-5 w-5 text-indigo-600" /><div className="text-xs uppercase tracking-[0.14em] text-slate-500">Email</div><div className="mt-2 font-semibold text-slate-900">{customer.email}</div></div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><Phone className="mb-2 h-5 w-5 text-indigo-600" /><div className="text-xs uppercase tracking-[0.14em] text-slate-500">Phone</div><div className="mt-2 font-semibold text-slate-900">{customer.phone || '—'}</div></div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Subscriptions</h2>
          <div className="space-y-3">{relatedSubscriptions.map((sub) => <div key={sub.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3"><div className="flex items-center justify-between"><div><div className="font-medium text-slate-900">{sub.number}</div><div className="text-xs text-slate-500">{sub.plan.name}</div></div><Badge tone={sub.status === 'ACTIVE' ? 'success' : 'neutral'}>{sub.status}</Badge></div></div>)}</div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Payments</h2>
          <div className="space-y-3">{relatedPayments.map((payment) => <div key={payment.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3"><div className="font-medium text-slate-900">{payment.method}</div><div className="mt-1 text-sm text-slate-600">${Number(payment.amount).toFixed(2)}</div></div>)}</div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Invoices</h2>
        <div className="space-y-3">{relatedInvoices.map((invoice) => <div key={invoice.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-3"><div><div className="font-medium text-slate-900">{invoice.number}</div><div className="text-xs text-slate-500">Due {invoice.dueDate}</div></div><div className="text-right"><div className="font-medium text-slate-900">${Number(invoice.total).toFixed(2)}</div><Badge tone={invoice.status === 'PAID' ? 'success' : 'warning'}>{invoice.status}</Badge></div></div>)}</div>
      </div>
    </div>
  );
}
