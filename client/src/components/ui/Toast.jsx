export default function Toast({ open, message, tone = 'info' }) {
  if (!open) return null;

  const styles = {
    info: 'border-sky-200 bg-sky-50 text-sky-800',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    danger: 'border-rose-200 bg-rose-50 text-rose-800',
  };

  return (
    <div className="fixed right-4 top-4 z-[60] max-w-sm rounded-xl border px-4 py-3 text-sm font-medium shadow-lg">
      <div className={['rounded-xl border px-4 py-3 shadow-lg', styles[tone] ?? styles.info].join(' ')}>
        {message}
      </div>
    </div>
  );
}
