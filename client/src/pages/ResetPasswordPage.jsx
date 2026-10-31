import { Link } from 'react-router-dom';
import { useState } from 'react';
import { Button, Input } from '../components/ui';

export function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const handleSubmit = (event) => {
    event.preventDefault();
    setConfirmed(true);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-soft">
        <div className="mb-6">
          <div className="mb-3 inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
            Secure
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Set a new password</h1>
        </div>

        {confirmed ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            Your password has been updated. You can now sign in with your new credentials.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="New password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="New password"
            />
            <Button type="submit" className="w-full">Update password</Button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-slate-600">
          <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
