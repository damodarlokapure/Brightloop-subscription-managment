export default function SearchInput({ value, onChange, placeholder = 'Search…', className = '' }) {
  return (
    <div className={['relative', className].join(' ')}>
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
          <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 104.32 9.41l2.74 2.75a1 1 0 101.42-1.42l-2.75-2.74A5.5 5.5 0 009 3.5zm0 2a3.5 3.5 0 110 7 3.5 3.5 0 010-7z" clipRule="evenodd" />
        </svg>
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
      />
    </div>
  );
}
