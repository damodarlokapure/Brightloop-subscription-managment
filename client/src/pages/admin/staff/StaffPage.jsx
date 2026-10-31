import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, UserCog, ToggleLeft, ToggleRight } from 'lucide-react';
import api from '../../../lib/api';
import { Button, Input, Modal, Badge, Toast, Spinner } from '../../../components/ui';

const staffSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Valid email is required'),
  password: z.string().min(9, 'Password must be at least 9 characters').refine((value) => /[A-Z]/.test(value) && /[a-z]/.test(value) && /[^A-Za-z0-9]/.test(value), 'Password must include uppercase, lowercase, and a special character'),
});

const fetchStaff = async () => {
  const { data } = await api.get('/users/staff');
  return data;
};

export function StaffPage() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const { data: staff = [], isLoading, isError } = useQuery({ queryKey: ['staff'], queryFn: fetchStaff });
  const form = useForm({ resolver: zodResolver(staffSchema), defaultValues: { name: '', email: '', password: 'TempPass!23' } });

  const createMutation = useMutation({
    mutationFn: async (payload) => api.post('/users/staff', payload),
    onSuccess: async () => {
      setToast({ tone: 'success', message: 'Staff member created.' });
      setIsOpen(false);
      form.reset({ name: '', email: '', password: 'TempPass!23' });
      await queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
    onError: (error) => {
      const message = error.response?.data?.error?.message || 'Unable to create staff member.';
      setToast({ tone: 'danger', message });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }) => api.patch(`/users/staff/${id}`, { isActive }),
    onSuccess: async () => {
      setToast({ tone: 'success', message: 'Staff status updated.' });
      await queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
    onError: (error) => {
      const message = error.response?.data?.error?.message || 'Unable to update staff status.';
      setToast({ tone: 'danger', message });
    },
  });

  const columns = useMemo(() => [
    { key: 'name', label: 'Name', render: (row) => <div className="font-medium text-slate-900">{row.name}</div> },
    { key: 'email', label: 'Email', render: (row) => row.email },
    { key: 'isActive', label: 'Status', render: (row) => <Badge tone={row.isActive ? 'success' : 'neutral'}>{row.isActive ? 'Active' : 'Inactive'}</Badge> },
    { label: 'Actions', render: (row) => (
      <button type="button" onClick={() => toggleMutation.mutate({ id: row.id, isActive: !row.isActive })} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100">
        {row.isActive ? <ToggleRight className="h-4 w-4 text-emerald-600" /> : <ToggleLeft className="h-4 w-4 text-slate-400" />} {row.isActive ? 'Deactivate' : 'Activate'}
      </button>
    ) },
  ], [toggleMutation]);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Team</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Staff management</h1>
          </div>
          <Button onClick={() => setIsOpen(true)}><Plus className="mr-2 h-4 w-4" /> Add staff</Button>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        {isLoading ? <div className="flex justify-center py-10"><Spinner /></div> : isError ? <div className="py-8 text-center text-rose-600">Unable to load staff.</div> : (
          <div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-200"><thead className="bg-slate-50"><tr>{columns.map((column) => <th key={column.label} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{column.label}</th>)}</tr></thead><tbody>{staff.map((row) => <tr key={row.id}>{columns.map((column) => <td key={`${row.id}-${column.label}`} className="px-4 py-3 text-sm text-slate-700">{column.render ? column.render(row) : row[column.key]}</td>)}</tr>)}</tbody></table></div>
        )}
      </div>

      <Modal open={isOpen} onClose={() => setIsOpen(false)} title="Add staff">
        <form onSubmit={form.handleSubmit((values) => createMutation.mutate(values))} className="space-y-4">
          <Input label="Name" {...form.register('name')} error={form.formState.errors.name?.message} />
          <Input label="Email" type="email" {...form.register('email')} error={form.formState.errors.email?.message} />
          <Input label="Temporary password" type="password" {...form.register('password')} error={form.formState.errors.password?.message} />
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            Password must be 9+ characters with uppercase, lowercase, and a special character.
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? 'Creating…' : 'Create staff'}</Button>
          </div>
        </form>
      </Modal>

      <Toast open={Boolean(toast)} message={toast?.message} tone={toast?.tone || 'info'} />
    </div>
  );
}
