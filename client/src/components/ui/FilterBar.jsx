export default function FilterBar({ children, className = '' }) {
  return (
    <div className={['flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3', className].join(' ')}>
      {children}
    </div>
  );
}
