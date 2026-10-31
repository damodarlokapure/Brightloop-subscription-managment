import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CalendarDays, Check, ChevronRight, Download, FileText, Lock, PencilLine, Printer, ShieldCheck, Sparkles, UserRound, Wallet } from 'lucide-react';
import { Badge, Button, Input, PageHeader, Select } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { customerRecords, invoiceRecords, paymentRecords, planCatalog, productCatalog, subscriptionRecords } from '../shared/operations/seedData';

const statusOrder = ['DRAFT', 'QUOTATION', 'CONFIRMED', 'ACTIVE', 'CLOSED'];

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function formatMoney(value) {
  return money.format(Number(value || 0));
}

function getCurrentCustomer(user) {
  if (!user) return customerRecords[0];
  return customerRecords.find((customer) => customer.email.toLowerCase() === user.email.toLowerCase()) || customerRecords[0];
}

function getCustomerSubscriptions(customerId) {
  return subscriptionRecords.filter((subscription) => subscription.customerId === customerId);
}

function getCustomerInvoices(customerId) {
  return invoiceRecords.filter((invoice) => invoice.customerId === customerId);
}

function getCustomerPayments(customerId) {
  const invoiceIds = new Set(getCustomerInvoices(customerId).map((invoice) => invoice.id));
  return paymentRecords.filter((payment) => invoiceIds.has(payment.invoiceId));
}

function getAllowedActions(subscription) {
  const actions = [];
  if (subscription.status === 'ACTIVE') {
    actions.push({ key: 'pause', label: 'Pause', allowed: true });
    actions.push({ key: 'close', label: 'Close', allowed: true });
  }
  if (subscription.status === 'CLOSED' || subscription.status === 'ACTIVE') {
    actions.push({ key: 'renew', label: 'Renew', allowed: true });
  }
  if (subscription.status === 'DRAFT' || subscription.status === 'QUOTATION' || subscription.status === 'CONFIRMED') {
    actions.push({ key: 'renew', label: 'Renew', allowed: false, message: 'This plan can only renew after it becomes active or ends.' });
  }
  if (subscription.status === 'ACTIVE') {
    actions.push({ key: 'close', label: 'Close', allowed: false, message: 'This subscription is already active. Use Pause if you want a temporary hold.' });
  }
  return actions;
}

function passwordChecklist(password = '') {
  return [
    { label: '9+ characters', valid: password.length >= 9 },
    { label: 'One uppercase letter', valid: /[A-Z]/.test(password) },
    { label: 'One lowercase letter', valid: /[a-z]/.test(password) },
    { label: 'One special character', valid: /[^A-Za-z0-9]/.test(password) },
  ];
}

export function CustomerDashboardPage() {
  const { user } = useAuth();
  const customer = getCurrentCustomer(user);
  const subscriptions = useMemo(() => getCustomerSubscriptions(customer.id), [customer.id]);
  const invoices = useMemo(() => getCustomerInvoices(customer.id), [customer.id]);
  const outstanding = invoices.reduce((sum, invoice) => sum + Number(invoice.outstanding || 0), 0);
  const overdue = invoices.filter((invoice) => invoice.status === 'CONFIRMED' && Number(invoice.outstanding || 0) > 0);
  const nextBilling = subscriptions.find((sub) => sub.status === 'ACTIVE')?.startDate || subscriptions[0]?.expiryDate || '—';

  const recentInvoices = [...invoices].sort((a, b) => new Date(b.issueDate) - new Date(a.issueDate)).slice(0, 3);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Hello"
        title={`Welcome back, ${customer.name.split(' ')[0]}`}
        subtitle="Here’s your subscription and billing snapshot."
        actions={[
          <Button key="new-request" variant="secondary" onClick={() => window.location.assign('/portal/plans')}><Sparkles className="mr-2 h-4 w-4" /> Browse plans</Button>,
        ]}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Active subscriptions</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">{subscriptions.filter((sub) => sub.status === 'ACTIVE').length}</div>
          <p className="mt-2 text-sm text-slate-600">Across {subscriptions.length} total subscriptions</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Next billing date</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">{nextBilling !== '—' ? new Date(nextBilling).toLocaleDateString() : '—'}</div>
          <p className="mt-2 text-sm text-slate-600">Auto-renewal schedule</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Outstanding balance</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">{formatMoney(outstanding)}</div>
          <p className="mt-2 text-sm text-slate-600">Current balance due</p>
        </div>
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-rose-700"><AlertTriangle className="h-4 w-4" /> Overdue</div>
          <div className="mt-2 text-2xl font-semibold text-rose-700">{overdue.length} invoice{overdue.length === 1 ? '' : 's'}</div>
          <p className="mt-2 text-sm text-rose-700">{formatMoney(overdue.reduce((sum, invoice) => sum + Number(invoice.outstanding || 0), 0))} needs attention</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Recent invoices</h2>
            <Link to="/portal/invoices" className="text-sm font-medium text-indigo-600">View all</Link>
          </div>
          <div className="space-y-3">
            {recentInvoices.map((invoice) => (
              <div key={invoice.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div>
                  <div className="font-medium text-slate-900">{invoice.number}</div>
                  <div className="text-xs text-slate-500">Due {invoice.dueDate}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-slate-900">{formatMoney(invoice.total)}</div>
                  <Badge tone={invoice.status === 'PAID' ? 'success' : invoice.status === 'CONFIRMED' ? 'warning' : 'neutral'}>{invoice.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Subscriptions</h2>
            <Link to="/portal/subscriptions" className="text-sm font-medium text-indigo-600">Open</Link>
          </div>
          <div className="space-y-3">
            {subscriptions.slice(0, 3).map((subscription) => (
              <div key={subscription.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-900">{subscription.number}</div>
                    <div className="text-xs text-slate-500">{subscription.plan?.name}</div>
                  </div>
                  <Badge tone={subscription.status === 'ACTIVE' ? 'success' : 'warning'}>{subscription.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function CustomerSubscriptionsPage() {
  const { user } = useAuth();
  const customer = getCurrentCustomer(user);
  const subscriptions = useMemo(() => getCustomerSubscriptions(customer.id), [customer.id]);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Your account" title="My subscriptions" subtitle="Review every active or pending subscription and what you can do next." />

      <div className="space-y-4">
        {subscriptions.map((subscription) => (
          <div key={subscription.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.16em] text-indigo-600">{subscription.number}</div>
                <div className="mt-1 text-xl font-semibold text-slate-900">{subscription.plan?.name}</div>
                <div className="mt-1 text-sm text-slate-500">Started {subscription.startDate} · Expires {subscription.expiryDate}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={subscription.status === 'ACTIVE' ? 'success' : subscription.status === 'CLOSED' ? 'neutral' : 'warning'}>{subscription.status}</Badge>
                <Link to={`/portal/subscriptions/${subscription.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600">
                  Details <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CustomerSubscriptionDetailPage() {
  const { user } = useAuth();
  const { subscriptionId } = useParams();
  const navigate = useNavigate();
  const customer = getCurrentCustomer(user);
  const subscription = getCustomerSubscriptions(customer.id).find((item) => item.id === subscriptionId) || getCustomerSubscriptions(customer.id)[0];
  const [notice, setNotice] = useState('');

  if (!subscription) {
    return <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-600">No subscription found.</div>;
  }

  const actionState = getAllowedActions(subscription);
  const steps = statusOrder.map((step, index) => ({
    id: step,
    active: statusOrder.indexOf(subscription.status) >= index,
  }));

  const handleAction = (actionKey) => {
    const action = actionState.find((entry) => entry.key === actionKey);
    if (action && !action.allowed) {
      setNotice(action.message || 'This update is not allowed right now.');
      return;
    }
    setNotice(`${action?.label || 'Action'} requested. We’ll review this within one business day.`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="secondary" onClick={() => navigate(-1)}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-indigo-600">Subscription</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">{subscription.number}</h1>
          </div>
          <Badge tone={subscription.status === 'ACTIVE' ? 'success' : 'warning'}>{subscription.status}</Badge>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-5">
          {steps.map((step) => (
            <div key={step.id} className={['rounded-2xl border p-3 text-center text-sm', step.active ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-slate-50 text-slate-500'].join(' ')}>
              {step.id}
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Plan details</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.15em] text-slate-500">Plan</div>
              <div className="mt-2 font-semibold text-slate-900">{subscription.plan?.name}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.15em] text-slate-500">Next billing</div>
              <div className="mt-2 font-semibold text-slate-900">{subscription.startDate}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.15em] text-slate-500">Expiry</div>
              <div className="mt-2 font-semibold text-slate-900">{subscription.expiryDate}</div>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="text-base font-semibold text-slate-900">Included items</h3>
            <div className="mt-4 space-y-3">
              {subscription.lines.map((line, index) => (
                <div key={`${line.productName}-${index}`} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div>
                    <div className="font-medium text-slate-900">{line.productName}</div>
                    <div className="text-xs text-slate-500">Qty {line.quantity}</div>
                  </div>
                  <div className="font-semibold text-slate-900">{formatMoney(line.amount)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Actions</h2>
          <div className="mt-4 space-y-3">
            {actionState.map((action) => (
              <button
                key={action.key}
                type="button"
                onClick={() => handleAction(action.key)}
                className={['w-full rounded-2xl border px-3 py-2.5 text-left text-sm font-medium transition', action.allowed ? 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100' : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'].join(' ')}
              >
                {action.label}
              </button>
            ))}
          </div>

          {notice ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{notice}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function CustomerPlansPage() {
  const [selectedPlan, setSelectedPlan] = useState(planCatalog[0]?.id || '');
  const [selectedProducts, setSelectedProducts] = useState({ 'prod-1': 1, 'prod-2': 0 });
  const [notice, setNotice] = useState('');

  const plan = planCatalog.find((entry) => entry.id === selectedPlan) || planCatalog[0];
  const productLines = productCatalog.map((product) => ({
    ...product,
    quantity: selectedProducts[product.id] || 0,
  })).filter((product) => product.quantity > 0);

  const subtotal = productLines.reduce((sum, product) => sum + product.unitPrice * product.quantity, 0);
  const total = subtotal + (plan ? Number(plan.price) : 0);

  const toggleProduct = (productId) => {
    setSelectedProducts((current) => ({
      ...current,
      [productId]: current[productId] ? 0 : 1,
    }));
  };

  const submit = () => {
    setNotice('Your subscription request has been submitted. A Brightloop team member will review it soon.');
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="New request" title="Browse plans" subtitle="Choose a plan and optional products to create a subscription request." />

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Select a plan</h2>
          <div className="mt-4 space-y-3">
            {planCatalog.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setSelectedPlan(entry.id)}
                className={['w-full rounded-2xl border p-4 text-left transition', selectedPlan === entry.id ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-slate-50'].join(' ')}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-900">{entry.name}</div>
                    <div className="text-xs text-slate-500">{entry.billingPeriod}</div>
                  </div>
                  <div className="text-lg font-semibold text-slate-900">{formatMoney(entry.price)}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Add products</h2>
          <div className="mt-4 space-y-3">
            {productCatalog.map((product) => (
              <div key={product.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div>
                  <div className="font-medium text-slate-900">{product.name}</div>
                  <div className="text-xs text-slate-500">{formatMoney(product.unitPrice)}</div>
                </div>
                <button type="button" onClick={() => toggleProduct(product.id)} className={['rounded-xl border px-3 py-1.5 text-sm font-medium', selectedProducts[product.id] ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-700'].join(' ')}>
                  {selectedProducts[product.id] ? 'Selected' : 'Add'}
                </button>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between text-sm text-slate-600"><span>Plan</span><span>{formatMoney(plan.price)}</span></div>
            <div className="mt-2 flex items-center justify-between text-sm text-slate-600"><span>Products</span><span>{formatMoney(subtotal)}</span></div>
            <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-2 text-base font-semibold text-slate-900"><span>Total</span><span>{formatMoney(total)}</span></div>
          </div>

          <div className="mt-4 flex gap-3">
            <Button onClick={submit}>Submit request</Button>
          </div>

          {notice ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function CustomerInvoicesPage() {
  const { user } = useAuth();
  const customer = getCurrentCustomer(user);
  const invoices = useMemo(() => getCustomerInvoices(customer.id), [customer.id]);
  const totals = invoices.reduce((sum, invoice) => sum + Number(invoice.outstanding || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Billing" title="My invoices" subtitle="Track amounts due and payment history for your account." actions={[<Badge key="balance" tone="warning">Outstanding: {formatMoney(totals)}</Badge>]} />

      <div className="space-y-4">
        {invoices.map((invoice) => (
          <div key={invoice.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.16em] text-indigo-600">{invoice.number}</div>
                <div className="mt-1 text-xl font-semibold text-slate-900">{formatMoney(invoice.total)}</div>
                <div className="mt-1 text-sm text-slate-500">Due {invoice.dueDate}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={invoice.status === 'PAID' ? 'success' : invoice.status === 'CONFIRMED' ? 'warning' : 'neutral'}>{invoice.status}</Badge>
                <Link to={`/portal/invoices/${invoice.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600">
                  Details <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CustomerInvoiceDetailPage() {
  const { user } = useAuth();
  const { invoiceId } = useParams();
  const navigate = useNavigate();
  const customer = getCurrentCustomer(user);
  const invoice = getCustomerInvoices(customer.id).find((entry) => entry.id === invoiceId) || getCustomerInvoices(customer.id)[0];
  const paymentHistory = getCustomerPayments(customer.id).filter((payment) => payment.invoiceId === invoice.id);

  if (!invoice) {
    return <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-600">Invoice not found.</div>;
  }

  const downloadInvoice = () => {
    const content = [
      `Invoice: ${invoice.number}`,
      `Customer: ${customer.name}`,
      `Status: ${invoice.status}`,
      `Outstanding: ${formatMoney(invoice.outstanding)}`,
      '',
      ...invoice.lines.map((line) => `${line.description}: ${formatMoney(line.amount)}`),
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${invoice.number}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <Button variant="secondary" onClick={() => navigate(-1)}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> Print</Button>
          <Button variant="secondary" onClick={downloadInvoice}><Download className="mr-2 h-4 w-4" /> Download</Button>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-indigo-600">Invoice</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">{invoice.number}</h1>
          </div>
          <Badge tone={invoice.status === 'PAID' ? 'success' : invoice.status === 'CONFIRMED' ? 'warning' : 'neutral'}>{invoice.status}</Badge>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="text-xs uppercase tracking-[0.15em] text-slate-500">Total</div><div className="mt-2 text-xl font-semibold text-slate-900">{formatMoney(invoice.total)}</div></div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="text-xs uppercase tracking-[0.15em] text-slate-500">Outstanding</div><div className="mt-2 text-xl font-semibold text-slate-900">{formatMoney(invoice.outstanding)}</div></div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="text-xs uppercase tracking-[0.15em] text-slate-500">Due date</div><div className="mt-2 text-xl font-semibold text-slate-900">{invoice.dueDate}</div></div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Line items</h2>
          <div className="mt-4 space-y-3">
            {invoice.lines.map((line, index) => (
              <div key={`${line.description}-${index}`} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div>
                  <div className="font-medium text-slate-900">{line.description}</div>
                  <div className="text-xs text-slate-500">Qty {line.quantity} · {line.taxRate}% tax</div>
                </div>
                <div className="font-semibold text-slate-900">{formatMoney(line.amount)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Payment history</h2>
          <div className="mt-4 space-y-3">
            {paymentHistory.length ? paymentHistory.map((payment) => (
              <div key={payment.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="font-medium text-slate-900">{payment.method}</div>
                <div className="mt-1 text-sm text-slate-600">{formatMoney(payment.amount)} · {payment.paymentDate}</div>
              </div>
            )) : <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">No payments recorded yet.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

export function CustomerProfilePage() {
  const { user } = useAuth();
  const customer = getCurrentCustomer(user);
  const [form, setForm] = useState({
    name: customer.name,
    email: customer.email,
    company: customer.company,
    phone: customer.phone,
  });
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  const checks = passwordChecklist(password);
  const isPasswordValid = checks.every((item) => item.valid);

  const handleSave = () => {
    setMessage('Your profile details were saved successfully.');
  };

  const handlePasswordChange = () => {
    if (!isPasswordValid) {
      setMessage('Please choose a stronger password that matches the checklist.');
      return;
    }
    setMessage('Your password was updated successfully.');
    setPassword('');
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Account" title="My profile" subtitle="Manage your personal and billing details." />

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3"><UserRound className="h-5 w-5 text-indigo-600" /><h2 className="text-lg font-semibold text-slate-900">Personal details</h2></div>
          <div className="space-y-4">
            <Input label="Full name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            <Input label="Email" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
            <Input label="Company" value={form.company} onChange={(event) => setForm((current) => ({ ...current, company: event.target.value }))} />
            <Input label="Phone" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
            <Button onClick={handleSave}><PencilLine className="mr-2 h-4 w-4" /> Save changes</Button>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3"><Lock className="h-5 w-5 text-indigo-600" /><h2 className="text-lg font-semibold text-slate-900">Change password</h2></div>
          <div className="space-y-4">
            <Input label="New password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Password requirements</div>
              <div className="space-y-2">
                {checks.map((item) => (
                  <div key={item.label} className="flex items-center gap-2 text-sm">
                    <span className={['flex h-5 w-5 items-center justify-center rounded-full', item.valid ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'].join(' ')}>
                      {item.valid ? <Check className="h-3.5 w-3.5" /> : '•'}
                    </span>
                    <span className={item.valid ? 'text-slate-700' : 'text-slate-500'}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <Button variant="secondary" onClick={handlePasswordChange}>Update password</Button>
          </div>
        </div>
      </div>

      {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div> : null}
    </div>
  );
}
