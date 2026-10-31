import { Navigate, Outlet } from 'react-router-dom';
import { Spinner } from './ui';
import { useAuth, roleRedirects } from '../contexts/AuthContext';

export function ProtectedRoute({ allowedRoles, children }) {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={roleRedirects[user.role] || '/login'} replace />;
  }

  if (children) {
    return children;
  }

  return <Outlet />;
}

export function PublicRoute({ children }) {
  const { isAuthenticated, user } = useAuth();

  if (isAuthenticated) {
    return <Navigate to={roleRedirects[user.role] || '/login'} replace />;
  }

  return children ?? <Outlet />;
}

export function AppLoadingState() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100">
      <div className="flex flex-col items-center gap-3 text-slate-600">
        <Spinner />
        <p className="text-sm font-medium">Loading Brightloop…</p>
      </div>
    </div>
  );
}
