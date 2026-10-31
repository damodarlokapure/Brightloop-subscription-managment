import { NavLink, Route, Routes } from 'react-router-dom';
import { CreditCard, Files, LayoutDashboard, Receipt, UserCircle2, ShoppingBag } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui';
import { CustomerDashboardPage, CustomerInvoiceDetailPage, CustomerInvoicesPage, CustomerPlansPage, CustomerProfilePage, CustomerSubscriptionDetailPage, CustomerSubscriptionsPage } from '../pages/portal/CustomerPortalPages';

const navItems = [
  { to: '/portal', label: 'Overview', icon: LayoutDashboard },
  { to: '/portal/subscriptions', label: 'Subscriptions', icon: Files },
  { to: '/portal/plans', label: 'Browse plans', icon: ShoppingBag },
  { to: '/portal/invoices', label: 'Invoices', icon: Receipt },
  { to: '/portal/profile', label: 'Profile', icon: UserCircle2 },
];

function EmptyDashboard({ title, subtitle }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
      <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm text-slate-600">{subtitle}</p>
    </div>
  );
}

export function PortalLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell flex bg-slate-100">
      <aside className="sidebar-glow hidden w-72 shrink-0 flex-col justify-between p-5 text-slate-100 lg:flex">
        <div>
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-lg font-semibold text-indigo-200">B</div>
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-indigo-200">Brightloop</p>
              <p className="text-lg font-semibold">Customer portal</p>
            </div>
          </div>

          <nav className="space-y-2">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/portal'}
                className={({ isActive }) =>
                  ['flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition', isActive ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'].join(' ')
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-indigo-200">Account</p>
          <p className="mt-2 text-sm font-semibold text-white">{user.name}</p>
          <p className="text-xs text-slate-300">{user.email}</p>
          <Button variant="secondary" className="mt-4 w-full justify-center bg-white text-slate-900 hover:bg-slate-100" onClick={logout}>
            Log out
          </Button>
        </div>
      </aside>

      <main className="flex-1 p-4 md:p-6">
        <div className="mb-6 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm lg:hidden">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-indigo-600">Brightloop</p>
            <p className="font-semibold text-slate-900">Customer portal</p>
          </div>
          <Button variant="secondary" onClick={logout}>Logout</Button>
        </div>

        <Routes>
          <Route index element={<CustomerDashboardPage />} />
          <Route path="subscriptions" element={<CustomerSubscriptionsPage />} />
          <Route path="subscriptions/:subscriptionId" element={<CustomerSubscriptionDetailPage />} />
          <Route path="plans" element={<CustomerPlansPage />} />
          <Route path="invoices" element={<CustomerInvoicesPage />} />
          <Route path="invoices/:invoiceId" element={<CustomerInvoiceDetailPage />} />
          <Route path="profile" element={<CustomerProfilePage />} />
        </Routes>
      </main>
    </div>
  );
}
