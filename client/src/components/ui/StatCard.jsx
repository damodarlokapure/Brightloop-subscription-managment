export default function StatCard({ label, value, hint, tone='slate' }) {
  const toneClasses = {
    slate: 'bg-slate-50 text-slate-700 ring-slate-200',
    indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    amber: 'bg-amber-50 text-amber-700 ring-amber-200',
    rose: 'bg-rose-50 text-rose-700 ring-rose-200',
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={['mb-3 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset', toneClasses[tone] ?? toneClasses.slate].join(' ')}>
        {label}
      </div>
      <div className="text-3xl font-semibold tracking-tight text-slate-900">{value}</div>
      {hint ? <p className="mt-2 text-sm text-slate-500">{hint}</p> : null}
    </div>
  );
}
