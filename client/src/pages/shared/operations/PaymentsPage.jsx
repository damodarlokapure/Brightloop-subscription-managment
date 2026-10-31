import { useQuery } from '@tanstack/react-query';
import { Input, Select, Badge } from '../../../components/ui';
import { paymentRecords } from './seedData';

const getPayments = async () => paymentRecords;

export function PaymentsPage() {
  const { data: payments = [] } = useQuery({ queryKey: ['payments'], queryFn: getPayments });

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Finance</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Payments</h1>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex-1"><Input placeholder="Search payment or invoice" /></div>
          <Select options={[{ value: 'ALL', label: 'All methods' }, { value: 'CARD', label: 'Card' }, { value: 'BANK_TRANSFER', label: 'Bank transfer' }, { value: 'ONLINE', label: 'Online' }]} />
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50"><tr><th className="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-slate-500">Invoice</th><th className="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-slate-500">Method</th><th className="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-slate-500">Amount</th><th className="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-slate-500">Date</th></tr></thead>
            <tbody className="divide-y divide-slate-200 bg-white">{payments.map((payment) => (
              <tr key={payment.id}><td className="px-4 py-3 text-sm text-slate-700">{payment.invoice?.number || payment.invoiceId}</td><td className="px-4 py-3 text-sm"><Badge tone="info">{payment.method}</Badge></td><td className="px-4 py-3 text-sm text-slate-700">${Number(payment.amount).toFixed(2)}</td><td className="px-4 py-3 text-sm text-slate-700">{payment.paymentDate}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
