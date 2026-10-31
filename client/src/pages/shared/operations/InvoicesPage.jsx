import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Send, FileText, Plus } from 'lucide-react';
import { Button, Input, Select, Badge, ConfirmDialog } from '../../../components/ui';
import { invoiceRecords } from './seedData';

const getInvoices = async () => invoiceRecords;

export function InvoicesPage() {
  const [status, setStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [confirmIds, setConfirmIds] = useState([]);
  const [sendMode, setSendMode] = useState(false);

  const { data: invoices = [] } = useQuery({ queryKey: ['invoices'], queryFn: getInvoices });

  const filtered = invoices.filter((invoice) => {
    const matchesStatus = status === 'ALL' || invoice.status === status;
    const haystack = `${invoice.number} ${invoice.customer?.name || ''}`.toLowerCase();
    return matchesStatus && haystack.includes(search.toLowerCase());
  });

  const selected = new Set(confirmIds);

  const toggleInvoice = (invoiceId) => {
    if (selected.has(invoiceId)) {
      selected.delete(invoiceId);
    } else {
      selected.add(invoiceId);
    }
    setConfirmIds([...selected]);
  };

  const columns = useMemo(() => [
    { label: 'Select', render: (row) => <input type="checkbox" checked={confirmIds.includes(row.id)} onChange={() => toggleInvoice(row.id)} /> },
    { label: 'Invoice', render: (row) => <div><div className="font-medium text-slate-900">{row.number}</div><div className="text-xs text-slate-500">{row.customer?.name}</div></div> },
    { label: 'Status', render: (row) => <Badge tone={row.status === 'PAID' ? 'success' : row.status === 'CANCELLED' ? 'neutral' : 'warning'}>{row.status}</Badge> },
    { label: 'Total', render: (row) => `$${Number(row.total).toFixed(2)}` },
    { label: 'Paid', render: (row) => `$${Number(row.paid || 0).toFixed(2)}` },
    { label: 'Outstanding', render: (row) => `$${Number(row.outstanding || 0).toFixed(2)}` },
    { label: 'Due', render: (row) => <div className={Number(row.outstanding || 0) > 0 ? 'text-rose-600' : 'text-slate-700'}>{row.dueDate}</div> },
  ], [confirmIds]);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Billing</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Invoices</h1>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setSendMode(true)} variant="secondary"><Send className="mr-2 h-4 w-4" /> Send</Button>
            <Button><CheckCircle2 className="mr-2 h-4 w-4" /> Confirm</Button>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex-1"><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search invoice or customer" /></div>
          <Select value={status} onChange={(event) => setStatus(event.target.value)} options={[{ value: 'ALL', label: 'All statuses' }, { value: 'DRAFT', label: 'Draft' }, { value: 'CONFIRMED', label: 'Confirmed' }, { value: 'PAID', label: 'Paid' }, { value: 'CANCELLED', label: 'Cancelled' }]} />
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50"><tr>{columns.map((column) => <th key={column.label} className="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-slate-500">{column.label}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-200 bg-white">{filtered.map((row) => <tr key={row.id}>{columns.map((column) => <td key={`${row.id}-${column.label}`} className="px-4 py-3 text-sm text-slate-700">{column.render(row)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog open={sendMode} title="Send selected invoices" description="Send the selected invoices to customers." confirmLabel="Send" onConfirm={() => setSendMode(false)} onCancel={() => setSendMode(false)} />
    </div>
  );
}

export function InvoiceDetailPage() {
  const invoice = invoiceRecords[0];

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Invoice</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">{invoice.number}</h1>
          </div>
          <Badge tone="success">{invoice.status}</Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Lines</h2>
          <div className="mt-4 space-y-3">{invoice.lines.map((line, index) => <div key={`${line.description}-${index}`} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-3"><div><div className="font-medium text-slate-900">{line.description}</div><div className="text-xs text-slate-500">Qty {line.quantity} · {line.taxRate}% tax</div></div><div className="font-semibold text-slate-900">${Number(line.amount).toFixed(2)}</div></div>)}</div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Totals</h2>
          <div className="mt-4 space-y-2 text-sm text-slate-700"><div className="flex justify-between"><span>Subtotal</span><span>${Number(invoice.subtotal).toFixed(2)}</span></div><div className="flex justify-between"><span>Tax</span><span>${Number(invoice.tax).toFixed(2)}</span></div><div className="flex justify-between"><span>Total</span><span className="font-semibold text-slate-900">${Number(invoice.total).toFixed(2)}</span></div></div>
        </div>
      </div>
    </div>
  );
}
