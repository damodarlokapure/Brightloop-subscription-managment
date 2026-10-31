import { ArrowUpDown } from 'lucide-react';

export default function Table({ columns = [], rows = [], loading = false, emptyMessage = 'No records found.', sortable = false, onSort }) {
  const renderCell = (column, row) => {
    if (typeof column.render === 'function') {
      return column.render(row);
    }

    const value = column.key ? row[column.key] : row[column.accessor];
    return value ?? '—';
  };

  if (loading) {
    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="animate-pulse space-y-3 p-4">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="h-12 rounded-xl bg-slate-200" />
          ))}
        </div>
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key || column.label}
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
                >
                  <div className="flex items-center gap-1">
                    <span>{column.label}</span>
                    {sortable && column.sortKey ? (
                      <button
                        type="button"
                        onClick={() => onSort?.(column.sortKey)}
                        className="inline-flex rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                        aria-label={`Sort by ${column.label}`}
                      >
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {rows.map((row, rowIndex) => (
              <tr key={row.id || rowIndex} className="hover:bg-slate-50/80">
                {columns.map((column) => (
                  <td key={`${row.id || rowIndex}-${column.key || column.label}`} className="px-4 py-3 text-sm text-slate-700">
                    {renderCell(column, row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
