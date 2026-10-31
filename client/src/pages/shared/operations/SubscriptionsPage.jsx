import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronRight } from 'lucide-react';
import { Button, Input, Select, Badge } from '../../../components/ui';
import { subscriptionRecords, overviewStats } from './seedData';

const statusOrder = ['DRAFT', 'QUOTATION', 'CONFIRMED', 'ACTIVE', 'CLOSED'];

const getSubscriptions = async () => subscriptionRecords;

export function SubscriptionsPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const { data: subscriptions = [] } = useQuery({ queryKey: ['subscriptions'], queryFn: getSubscriptions });

  const filtered = subscriptions.filter((subscription) => {
    const matchesStatus = statusFilter === 'ALL' || subscription.status === statusFilter;
    const haystack = `${subscription.customer?.name || ''} ${subscription.plan?.name || ''} ${subscription.number}`.toLowerCase();
    const matchesSearch = haystack.includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const statusSummary = statusOrder.map((status) => ({ status, count: subscriptions.filter((subscription) => subscription.status === status).length }));

  const columns = useMemo(() => [
    { label: 'Subscription', render: (row) => <div><div className="font-medium text-slate-900">{row.number}</div><div className="text-xs text-slate-500">{row.customer?.name}</div></div> },
    { label: 'Plan', render: (row) => row.plan?.name },
    { label: 'Status', render: (row) => <Badge tone={row.status === 'ACTIVE' ? 'success' : row.status === 'CLOSED' ? 'neutral' : 'warning'}>{row.status}</Badge> },
    { label: 'Start', render: (row) => row.startDate },
    { label: 'Expiry', render: (row) => row.expiryDate || '—' },
    { label: 'Action', render: (row) => <button type="button" className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600" onClick={() => navigate(`/admin/subscriptions/${row.id}`)}>Open <ChevronRight className="h-4 w-4" /></button> },
  ], [navigate]);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Operations</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Subscriptions</h1>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-5">
          {statusSummary.map(({ status, count }) => (
            <button key={status} type="button" onClick={() => setStatusFilter(current => current === status ? 'ALL' : status)} className={["rounded-2xl border p-3 text-left transition", statusFilter === status ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'].join(' ')}>
              <div className="text-xs uppercase tracking-[0.12em] text-slate-500">{status}</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">{count}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex-1">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customer or plan" />
            </div>
          </div>
          <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} options={[{ value: 'ALL', label: 'All statuses' }, ...statusOrder.map((status) => ({ value: status, label: status }))]} />
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50"><tr>{columns.map((column) => <th key={column.label} className="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-slate-500">{column.label}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-200 bg-white">{filtered.map((row) => <tr key={row.id}>{columns.map((column) => <td key={`${row.id}-${column.label}`} className="px-4 py-3 text-sm text-slate-700">{column.render(row)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function SubscriptionDetailPage() {
  const { subscriptionId } = useNavigate() ? { subscriptionId: 'sub-1' } : { subscriptionId: 'sub-1' };
  const subscription = subscriptionRecords.find((entry) => entry.id === subscriptionId) || subscriptionRecords[0];

  const steps = ['DRAFT', 'QUOTATION', 'CONFIRMED', 'ACTIVE', 'CLOSED'];
  const currentIndex = steps.indexOf(subscription.status);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Lifecycle</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">{subscription.number}</h1>
          </div>
          <Badge tone={subscription.status === 'ACTIVE' ? 'success' : 'warning'}>{subscription.status}</Badge>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-5">
          {steps.map((step, index) => (
            <div key={step} className={['rounded-2xl border p-3 text-center', index <= currentIndex ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-slate-50 text-slate-500'].join(' ')}>
              <div className="text-xs uppercase tracking-[0.12em]">{step}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Lines</h2>
          <div className="mt-4 space-y-3">{subscription.lines.map((line, index) => <div key={`${line.productId}-${index}`} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-3"><div><div className="font-medium text-slate-900">{line.productName}</div><div className="text-xs text-slate-500">Qty {line.quantity}</div></div><div className="font-semibold text-slate-900">${Number(line.amount).toFixed(2)}</div></div>)}</div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Activity timeline</h2>
          <div className="mt-4 space-y-3">{subscription.auditHistory.map((event) => <div key={event.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3"><div className="text-sm font-medium text-slate-900">{event.action}</div><div className="mt-1 text-xs text-slate-500">{new Date(event.at).toLocaleString()} · {event.actor}</div><div className="mt-1 text-sm text-slate-600">{event.details}</div></div>)}</div>
        </div>
      </div>
    </div>
  );
}
