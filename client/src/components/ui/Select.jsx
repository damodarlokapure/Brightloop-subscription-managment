export default function Select({ label, error, options = [], className = '', ...props }) {
  return (
    <label className="block w-full text-sm text-slate-700">
      {label ? <span className="mb-1.5 block font-medium text-slate-700">{label}</span> : null}
      <select
        className={[
          'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100',
          error ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-100' : '',
          className,
        ].join(' ')}
        {...props}
      >
        {options.map((option) => (
          <option key={String(option.value)} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <span className="mt-1.5 block text-xs font-medium text-rose-600">{error}</span> : null}
    </label>
  );
}
