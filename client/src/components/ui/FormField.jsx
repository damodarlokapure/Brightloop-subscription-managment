export default function FormField({ children, label, error }) {
  return (
    <label className="block w-full text-sm text-slate-700">
      {label ? <span className="mb-1.5 block font-medium text-slate-700">{label}</span> : null}
      {children}
      {error ? <span className="mt-1.5 block text-xs font-medium text-rose-600">{error}</span> : null}
    </label>
  );
}
