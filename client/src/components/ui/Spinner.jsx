export default function Spinner({ className = 'h-5 w-5 text-indigo-600' }) {
  return (
    <svg
      className={['animate-spin', className].join(' ')}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-label="Loading"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2.93 7.07A8 8 0 0112 4v4a4 4 0 00-2.93 1.93l-2.07 2.14z" />
    </svg>
  );
}
