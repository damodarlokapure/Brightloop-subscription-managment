import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CalendarRange, Download, Printer, Search } from 'lucide-react';
import { Badge, Button, Input, PageHeader, Pagination, Select, StatCard, Table } from '../../../components/ui';
import { customerRecords, invoiceRecords, paymentRecords, planCatalog, subscriptionRecords } from '../operations/seedData';

const tabs = ['active-subscriptions', 'payments', 'overdue-invoices'];
const rangePresets = [
  { value: 'thisMonth', label: 'This month' },
  { value: 'lastMonth', label: 'Last month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
  { value: 'custom', label: 'Custom' },
];
const statToneMap = { active: 'indigo', mrr: 'emerald', collected: 'emerald', outstanding: 'amber', overdue: 'rose' };
const statusColors = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#64748b'];

const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const compactCurrencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });

function formatCurrency(value) {
  return currencyFormatter.format(Number(value || 0));
}

function formatCompactCurrency(value) {
  return compactCurrencyFormatter.format(Number(value || 0));
}

function toCsv(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const csvValues = rows.map((row) => headers.map((header) => `"${String(row[header] ?? '').replace(/"/g, '""')}"`).join(','));
  return [headers.join(','), ...csvValues].join('\n');
}

function downloadCsv(rows, fileName) {
  const csvText = toCsv(rows);
  if (!csvText) return;
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function compareText(current, previous) {
  if (previous === 0) return 'No prior period';
  const delta = ((current - previous) / previous) * 100;
  const prefix = delta >= 0 ? '+' : '';
  return `${prefix}${delta.toFixed(1)}% vs prev`; 
}

function getRangeBounds(range, customStart, customEnd) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const thisMonthStart = new Date(currentYear, currentMonth, 1);
  const thisMonthEnd = new Date(currentYear, currentMonth + 1, 0);

  const lastMonthStart = new Date(currentYear, currentMonth - 1, 1);
  const lastMonthEnd = new Date(currentYear, currentMonth, 0);

  const quarterStart = new Date(currentYear, Math.floor(currentMonth / 3) * 3, 1);
  const quarterEnd = new Date(currentYear, Math.floor(currentMonth / 3) * 3 + 3, 0);

  const yearStart = new Date(currentYear, 0, 1);
  const yearEnd = new Date(currentYear, 11, 31);

  switch (range) {
    case 'thisMonth':
      return { start: thisMonthStart, end: thisMonthEnd };
    case 'lastMonth':
      return { start: lastMonthStart, end: lastMonthEnd };
    case 'quarter':
      return { start: quarterStart, end: quarterEnd };
    case 'year':
      return { start: yearStart, end: yearEnd };
    case 'custom':
      return { start: customStart ? new Date(customStart) : thisMonthStart, end: customEnd ? new Date(customEnd) : thisMonthEnd };
    default:
      return { start: thisMonthStart, end: thisMonthEnd };
  }
}

function normalizeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function inRange(dateValue, rangeStart, rangeEnd) {
  if (!dateValue) return true;
  const date = normalizeDate(dateValue);
  if (!date) return true;
  if (rangeStart && date < rangeStart) return false;
  if (rangeEnd && date > rangeEnd) return false;
  return true;
}

function buildBaseFilters(filters) {
  const range = filters.range || 'thisMonth';
  const bounds = getRangeBounds(range, filters.startDate, filters.endDate);
  const plan = filters.plan || 'ALL';
  const customer = filters.customer || 'ALL';

  const filteredSubscriptions = subscriptionRecords.filter((sub) => {
    if (plan !== 'ALL' && sub.planId !== plan) return false;
    if (customer !== 'ALL' && sub.customerId !== customer) return false;
    return inRange(sub.startDate, bounds.start, bounds.end) || inRange(sub.expiryDate, bounds.start, bounds.end);
  });

  const filteredInvoices = invoiceRecords.filter((invoice) => {
    if (plan !== 'ALL' && subscriptionRecords.find((sub) => sub.id === invoice.subscriptionId)?.planId !== plan) return false;
    if (customer !== 'ALL' && invoice.customerId !== customer) return false;
    return inRange(invoice.issueDate, bounds.start, bounds.end) || inRange(invoice.dueDate, bounds.start, bounds.end);
  });

  const filteredPayments = paymentRecords.filter((payment) => {
    const invoice = payment.invoice || invoiceRecords.find((entry) => entry.id === payment.invoiceId);
    if (!invoice) return false;
    if (plan !== 'ALL' && subscriptionRecords.find((sub) => sub.id === invoice.subscriptionId)?.planId !== plan) return false;
    if (customer !== 'ALL' && invoice.customerId !== customer) return false;
    return inRange(payment.paymentDate, bounds.start, bounds.end);
  });

  return { filteredSubscriptions, filteredInvoices, filteredPayments, bounds };
}

function getDashboardData(filters) {
  const { filteredSubscriptions, filteredInvoices, filteredPayments, bounds } = buildBaseFilters(filters);

  const activeSubscriptions = filteredSubscriptions.filter((sub) => sub.status === 'ACTIVE');
  const mrr = filteredSubscriptions
    .filter((sub) => sub.status === 'ACTIVE')
    .reduce((sum, sub) => sum + Number(sub.plan?.price || 0), 0);

  const revenueCollected = filteredPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const outstanding = filteredInvoices.reduce((sum, invoice) => sum + Number(invoice.outstanding || 0), 0);
  const overdueInvoices = filteredInvoices.filter((invoice) => invoice.status === 'CONFIRMED' && Number(invoice.outstanding || 0) > 0);
  const overdueAmount = overdueInvoices.reduce((sum, invoice) => sum + Number(invoice.outstanding || 0), 0);

  const revenueTrend = [
    { label: 'Jan', invoiced: 12000, collected: 9800 },
    { label: 'Feb', invoiced: 15000, collected: 11250 },
    { label: 'Mar', invoiced: 17000, collected: 14600 },
    { label: 'Apr', invoiced: 14500, collected: 13800 },
    { label: 'May', invoiced: 18800, collected: 15900 },
    { label: 'Jun', invoiced: 21500, collected: 19000 },
  ];

  const statusData = [
    { name: 'Active', value: filteredSubscriptions.filter((sub) => sub.status === 'ACTIVE').length },
    { name: 'Draft', value: filteredSubscriptions.filter((sub) => sub.status === 'DRAFT').length },
    { name: 'Quotation', value: filteredSubscriptions.filter((sub) => sub.status === 'QUOTATION').length },
    { name: 'Confirmed', value: filteredSubscriptions.filter((sub) => sub.status === 'CONFIRMED').length },
    { name: 'Closed', value: filteredSubscriptions.filter((sub) => sub.status === 'CLOSED').length },
  ].filter((entry) => entry.value > 0);

  const planTotals = planCatalog.map((plan) => ({
    name: plan.name,
    value: filteredInvoices.reduce((sum, invoice) => {
      const invoiceSubscription = subscriptionRecords.find((sub) => sub.id === invoice.subscriptionId);
      return invoiceSubscription?.planId === plan.id ? sum + Number(invoice.total || 0) : sum;
    }, 0),
  }));

  const methodTotals = Object.entries(
    filteredPayments.reduce((acc, payment) => {
      acc[payment.method] = (acc[payment.method] || 0) + Number(payment.amount || 0);
      return acc;
    }, {}),
  ).map(([name, value]) => ({ name, value }));

  const activeRows = filteredSubscriptions
    .filter((sub) => sub.status === 'ACTIVE')
    .map((sub) => ({
      id: sub.id,
      customer: sub.customer?.name || 'Unknown customer',
      plan: sub.plan?.name || 'Unknown plan',
      status: sub.status,
      mrr: Number(sub.plan?.price || 0),
      nextInvoice: sub.startDate,
    }));

  const paymentRows = filteredPayments.map((payment) => ({
    id: payment.id,
    invoice: payment.invoice?.number || payment.invoiceId || '—',
    customer: payment.invoice?.customer?.name || 'Unknown customer',
    method: payment.method,
    amount: Number(payment.amount || 0),
    date: payment.paymentDate,
  }));

  const overdueRows = overdueInvoices.map((invoice) => ({
    id: invoice.id,
    invoice: invoice.number,
    customer: invoice.customer?.name || 'Unknown customer',
    dueDate: invoice.dueDate,
    outstanding: Number(invoice.outstanding || 0),
    daysPastDue: Math.max(0, Math.ceil((new Date() - new Date(invoice.dueDate)) / 86400000)),
  }));

  return {
    stats: {
      activeSubscriptions: activeSubscriptions.length,
      mrr,
      revenueCollected,
      outstanding,
      overdueInvoicesCount: overdueInvoices.length,
      overdueAmount,
      comparison: {
        activeSubscriptions: { value: 15, label: 'vs last period' },
        mrr: { value: 12.8, label: 'vs last period' },
        revenueCollected: { value: 8.4, label: 'vs last period' },
        outstanding: { value: -5.8, label: 'vs last period' },
        overdueInvoices: { value: -2.1, label: 'vs last period' },
      },
    },
    revenueTrend,
    statusData,
    planTotals,
    methodTotals,
    activeRows,
    paymentRows,
    overdueRows,
  };
}

function StatCardRow({ stats }) {
  const statItems = [
    { key: 'activeSubscriptions', label: 'Active subscriptions', value: stats.activeSubscriptions, tone: 'indigo', hint: compareText(stats.activeSubscriptions, stats.activeSubscriptions * 0.85) },
    { key: 'mrr', label: 'MRR', value: formatCurrency(stats.mrr), tone: 'emerald', hint: compareText(stats.mrr, stats.mrr * 0.88) },
    { key: 'revenueCollected', label: 'Revenue collected', value: formatCurrency(stats.revenueCollected), tone: 'emerald', hint: compareText(stats.revenueCollected, stats.revenueCollected * 0.91) },
    { key: 'outstanding', label: 'Outstanding amount', value: formatCurrency(stats.outstanding), tone: 'amber', hint: compareText(stats.outstanding, stats.outstanding * 1.08) },
    { key: 'overdueInvoices', label: 'Overdue invoices', value: `${stats.overdueInvoicesCount} / ${formatCurrency(stats.overdueAmount)}`, tone: 'rose', hint: compareText(stats.overdueAmount, stats.overdueAmount * 1.12) },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      {statItems.map((item) => (
        <StatCard key={item.key} label={item.label} value={item.value} hint={item.hint} tone={statToneMap[item.key] || 'slate'} />
      ))}
    </div>
  );
}

function DashboardChartSkeleton({ height = 260 }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 h-5 w-32 animate-pulse rounded bg-slate-200" />
      <div className="animate-pulse rounded-2xl bg-slate-100" style={{ height }} />
    </div>
  );
}

function SummaryView({ data, filters }) {
  return (
    <div className="space-y-5 print:space-y-3">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm print:border-slate-300">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Finance summary</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">{filters.range === 'custom' ? 'Custom range' : filters.range.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase())}</h2>
          </div>
          <Badge tone="info">{formatCurrency(data.stats.mrr)} MRR</Badge>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-[0.12em] text-slate-500">Active subscriptions</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{data.stats.activeSubscriptions}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-[0.12em] text-slate-500">Revenue collected</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(data.stats.revenueCollected)}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-[0.12em] text-slate-500">Outstanding</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(data.stats.outstanding)}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-[0.12em] text-slate-500">Overdue invoices</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{data.stats.overdueInvoicesCount}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-[0.12em] text-slate-500">Overdue amount</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(data.stats.overdueAmount)}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-lg font-semibold text-slate-900">Revenue trend</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.revenueTrend}>
                <defs>
                  <linearGradient id="revenueFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `$${Math.round(value / 1000)}k`} />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Area type="monotone" dataKey="invoiced" stroke="#4f46e5" strokeWidth={2} fill="url(#revenueFill)" />
                <Area type="monotone" dataKey="collected" stroke="#10b981" strokeWidth={2} fill="url(#revenueFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-lg font-semibold text-slate-900">Plan mix</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.planTotals}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `$${Math.round(value / 1000)}k`} />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Bar dataKey="value" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FinanceDashboardPage() {
  const [summaryView, setSummaryView] = useState(false);
  const [rangePreset, setRangePreset] = useState('thisMonth');
  const [planFilter, setPlanFilter] = useState('ALL');
  const [customerFilter, setCustomerFilter] = useState('ALL');
  const [customStart, setCustomStart] = useState('2026-10-01');
  const [customEnd, setCustomEnd] = useState('2026-10-31');
  const [tab, setTab] = useState('active-subscriptions');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 5;

  const filters = useMemo(
    () => ({ range: rangePreset, plan: planFilter, customer: customerFilter, startDate: customStart, endDate: customEnd }),
    [rangePreset, planFilter, customerFilter, customStart, customEnd],
  );

  const statsQuery = useQuery({
    queryKey: ['finance-stats', filters],
    queryFn: async () => getDashboardData(filters).stats,
    staleTime: 30_000,
  });

  const revenueTrendQuery = useQuery({
    queryKey: ['finance-trend', filters],
    queryFn: async () => getDashboardData(filters).revenueTrend,
    staleTime: 30_000,
  });

  const statusQuery = useQuery({
    queryKey: ['finance-status', filters],
    queryFn: async () => getDashboardData(filters).statusData,
    staleTime: 30_000,
  });

  const planQuery = useQuery({
    queryKey: ['finance-plan', filters],
    queryFn: async () => getDashboardData(filters).planTotals,
    staleTime: 30_000,
  });

  const paymentsQuery = useQuery({
    queryKey: ['finance-methods', filters],
    queryFn: async () => getDashboardData(filters).methodTotals,
    staleTime: 30_000,
  });

  const activeRowsQuery = useQuery({
    queryKey: ['finance-table-active', filters],
    queryFn: async () => getDashboardData(filters).activeRows,
    staleTime: 30_000,
  });

  const paymentRowsQuery = useQuery({
    queryKey: ['finance-table-payments', filters],
    queryFn: async () => getDashboardData(filters).paymentRows,
    staleTime: 30_000,
  });

  const overdueRowsQuery = useQuery({
    queryKey: ['finance-table-overdue', filters],
    queryFn: async () => getDashboardData(filters).overdueRows,
    staleTime: 30_000,
  });

  const dashboardData = useMemo(() => getDashboardData(filters), [filters]);

  const activeRows = useMemo(() => {
    const rows = tab === 'active-subscriptions' ? dashboardData.activeRows : tab === 'payments' ? dashboardData.paymentRows : dashboardData.overdueRows;
    const query = search.trim().toLowerCase();
    const result = rows.filter((row) => {
      if (!query) return true;
      const haystack = Object.values(row).join(' ').toLowerCase();
      return haystack.includes(query);
    });
    return result;
  }, [dashboardData, tab, search]);

  const totalPages = Math.max(1, Math.ceil(activeRows.length / pageSize));
  const paginatedRows = activeRows.slice((page - 1) * pageSize, page * pageSize);

  const setPreset = (value) => {
    setRangePreset(value);
    setPage(1);
  };

  const tableColumns = {
    'active-subscriptions': [
      { label: 'Customer', key: 'customer', render: (row) => row.customer },
      { label: 'Plan', key: 'plan', render: (row) => row.plan },
      { label: 'Status', key: 'status', render: (row) => <Badge tone="success">{row.status}</Badge> },
      { label: 'MRR', key: 'mrr', render: (row) => formatCurrency(row.mrr) },
      { label: 'Next invoice', key: 'nextInvoice', render: (row) => row.nextInvoice },
    ],
    payments: [
      { label: 'Invoice', key: 'invoice', render: (row) => row.invoice },
      { label: 'Customer', key: 'customer', render: (row) => row.customer },
      { label: 'Method', key: 'method', render: (row) => <Badge tone="info">{row.method}</Badge> },
      { label: 'Amount', key: 'amount', render: (row) => formatCurrency(row.amount) },
      { label: 'Date', key: 'date', render: (row) => row.date },
    ],
    'overdue-invoices': [
      { label: 'Invoice', key: 'invoice', render: (row) => row.invoice },
      { label: 'Customer', key: 'customer', render: (row) => row.customer },
      { label: 'Due date', key: 'dueDate', render: (row) => row.dueDate },
      { label: 'Outstanding', key: 'outstanding', render: (row) => formatCurrency(row.outstanding) },
      { label: 'Days past due', key: 'daysPastDue', render: (row) => row.daysPastDue },
    ],
  };

  const exportRows = tab === 'active-subscriptions' ? dashboardData.activeRows : tab === 'payments' ? dashboardData.paymentRows : dashboardData.overdueRows;

  const exportCsv = () => {
    const fileName = `${tab}.csv`;
    const rows = exportRows.map((row) => ({
      ...row,
      amount: typeof row.amount === 'number' ? row.amount : row.mrr ?? row.outstanding ?? 0,
    }));
    downloadCsv(rows, fileName);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Finance"
        title="Finance dashboard"
        subtitle="Revenue performance, collections, and subscription health in one place."
        actions={[
          <Button key="summary" variant="secondary" onClick={() => setSummaryView((value) => !value)}>{summaryView ? 'Detailed view' : 'Summary view'}</Button>,
          <Button key="print" variant="secondary" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> Print</Button>,
        ]}
      />

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
          <div className="flex flex-1 flex-wrap gap-3">
            <div className="min-w-[160px] flex-1">
              <Select label="Date range" value={rangePreset} onChange={(event) => setPreset(event.target.value)} options={rangePresets} />
            </div>
            <div className="min-w-[160px] flex-1">
              <Select label="Plan" value={planFilter} onChange={(event) => setPlanFilter(event.target.value)} options={[{ value: 'ALL', label: 'All plans' }, ...planCatalog.map((plan) => ({ value: plan.id, label: plan.name }))]} />
            </div>
            <div className="min-w-[180px] flex-1">
              <Select label="Customer" value={customerFilter} onChange={(event) => setCustomerFilter(event.target.value)} options={[{ value: 'ALL', label: 'All customers' }, ...customerRecords.map((customer) => ({ value: customer.id, label: customer.name }))]} />
            </div>
          </div>

          {rangePreset === 'custom' ? (
            <div className="flex flex-wrap gap-3 xl:justify-end">
              <Input type="date" label="From" value={customStart} onChange={(event) => setCustomStart(event.target.value)} />
              <Input type="date" label="To" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} />
            </div>
          ) : null}
        </div>
      </div>

      {summaryView ? (
        <SummaryView data={dashboardData} filters={filters} />
      ) : (
        <>
          <div className="space-y-4">
            {statsQuery.isPending ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                {new Array(5).fill(null).map((_, index) => (
                  <div key={index} className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm" />
                ))}
              </div>
            ) : (
              <StatCardRow stats={statsQuery.data || dashboardData.stats} />
            )}
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            {revenueTrendQuery.isPending ? (
              <DashboardChartSkeleton />
            ) : (
              <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-900">Revenue trend</h3>
                  <Badge tone="info">Invoiced vs collected</Badge>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueTrendQuery.data || dashboardData.revenueTrend}>
                      <defs>
                        <linearGradient id="invoicedFill" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.03} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `$${Math.round(value / 1000)}k`} />
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                      <Area type="monotone" dataKey="invoiced" stroke="#4f46e5" fill="url(#invoicedFill)" strokeWidth={2.5} />
                      <Line type="monotone" dataKey="collected" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {statusQuery.isPending ? (
              <DashboardChartSkeleton />
            ) : (
              <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-900">Subscriptions by status</h3>
                  <Badge tone="neutral">{(statusQuery.data || dashboardData.statusData).reduce((sum, item) => sum + item.value, 0)} total</Badge>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={statusQuery.data || dashboardData.statusData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={84} paddingAngle={2}>
                        {(statusQuery.data || dashboardData.statusData).map((entry, index) => (
                          <Cell key={`${entry.name}-${index}`} fill={statusColors[index % statusColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => `${value}`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(statusQuery.data || dashboardData.statusData).map((entry, index) => (
                    <div key={entry.name} className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: statusColors[index % statusColors.length] }} />
                      {entry.name} · {entry.value}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            {planQuery.isPending ? (
              <DashboardChartSkeleton />
            ) : (
              <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-900">Revenue by plan</h3>
                  <Badge tone="info">Gross invoiced</Badge>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={planQuery.data || dashboardData.planTotals}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `$${Math.round(value / 1000)}k`} />
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                      <Bar dataKey="value" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {paymentsQuery.isPending ? (
              <DashboardChartSkeleton />
            ) : (
              <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-900">Payments by method</h3>
                  <Badge tone="success">Collected</Badge>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={paymentsQuery.data || dashboardData.methodTotals}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `$${Math.round(value / 1000)}k`} />
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                      <Bar dataKey="value" fill="#14b8a6" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex gap-2">
                {tabs.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => { setTab(item); setPage(1); }}
                    className={['rounded-xl px-3 py-2 text-sm font-medium transition', item === tab ? 'bg-indigo-600 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'].join(' ')}
                  >
                    {item === 'active-subscriptions' ? 'Active subscriptions' : item === 'payments' ? 'Payments' : 'Overdue invoices'}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <div className="relative min-w-[200px]">
                  <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input className="pl-9" placeholder="Search records" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
                </div>
                <Button variant="secondary" onClick={exportCsv}><Download className="mr-2 h-4 w-4" /> CSV export</Button>
              </div>
            </div>

            {tab === 'active-subscriptions' && activeRowsQuery.isPending ? (
              <div className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />
            ) : tab === 'payments' && paymentRowsQuery.isPending ? (
              <div className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />
            ) : tab === 'overdue-invoices' && overdueRowsQuery.isPending ? (
              <div className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />
            ) : (
              <>
                <Table columns={tableColumns[tab]} rows={paginatedRows} emptyMessage="No records match the current filters." />
                <div className="mt-4">
                  <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
