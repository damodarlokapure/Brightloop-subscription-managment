import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, BellRing } from 'lucide-react';
import { Button, Badge } from '../../../components/ui';
import { invoiceRecords } from './seedData';

const getOverdue = async () => invoiceRecords.filter((invoice) => Number(invoice.outstanding || 0) > 0 && invoice.status === 'CONFIRMED');

export function OverduePage() {
  const { data: overdue = [] } = useQuery({ queryKey: ['overdue'], queryFn: getOverdue });

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Collections</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Overdue invoices</h1>
          </div>
          <Badge tone="warning">{overdue.length} overdue</Badge>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="space-y-3">
          {overdue.map((invoice) => (
            <div key={invoice.id} className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-600"><AlertTriangle className="h-5 w-5" /></div>
                <div>
                  <div className="font-medium text-slate-900">{invoice.number}</div>
                  <div className="text-xs text-slate-500">{invoice.customer?.name} · Due {invoice.dueDate}</div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-sm font-semibold text-rose-700">${Number(invoice.outstanding).toFixed(2)}</div>
                  <div className="text-xs text-rose-600">{Math.max(1, Math.ceil((new Date() - new Date(invoice.dueDate)) / (1000 * 60 * 60 * 24)))} days overdue</div>
                </div>
                <Button variant="secondary"><BellRing className="mr-2 h-4 w-4" /> Send reminder</Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
