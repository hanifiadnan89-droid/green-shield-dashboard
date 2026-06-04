import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';

const PAGE_SIZES = [10, 25, 50, 100];

export default function LeadsPagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, total);

  const pages = [];
  const maxVisible = 5;
  let lo = Math.max(1, safePage - 2);
  let hi = Math.min(totalPages, lo + maxVisible - 1);
  lo = Math.max(1, hi - maxVisible + 1);
  for (let p = lo; p <= hi; p++) pages.push(p);

  return (
    <footer className="lc-pagination">
      <p className="lc-pagination__summary">
        Showing <strong>{start}</strong> to <strong>{end}</strong> of{' '}
        <strong>{total.toLocaleString()}</strong> results
      </p>

      <div className="lc-pagination__controls">
        <label className="lc-pagination__size">
          <span className="sr-only">Rows per page</span>
          <select
            value={pageSize}
            onChange={e => onPageSizeChange(Number(e.target.value))}
            className="lc-pagination__select"
            aria-label="Results per page"
          >
            {PAGE_SIZES.map(n => (
              <option key={n} value={n}>{n} per page</option>
            ))}
          </select>
        </label>

        <nav className="lc-pagination__nav" aria-label="Pagination">
          <button
            type="button"
            className="lc-pagination__btn"
            disabled={safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft size={16} />
          </button>

          {lo > 1 && (
            <>
              <button type="button" className="lc-pagination__btn" onClick={() => onPageChange(1)}>1</button>
              {lo > 2 && <span className="lc-pagination__ellipsis">…</span>}
            </>
          )}

          {pages.map(p => (
            <motion.button
              key={p}
              type="button"
              className={`lc-pagination__btn ${p === safePage ? 'lc-pagination__btn--active' : ''}`}
              onClick={() => onPageChange(p)}
              whileTap={{ scale: 0.96 }}
            >
              {p}
            </motion.button>
          ))}

          {hi < totalPages && (
            <>
              {hi < totalPages - 1 && <span className="lc-pagination__ellipsis">…</span>}
              <button
                type="button"
                className="lc-pagination__btn"
                onClick={() => onPageChange(totalPages)}
              >
                {totalPages}
              </button>
            </>
          )}

          <button
            type="button"
            className="lc-pagination__btn"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(safePage + 1)}
            aria-label="Next page"
          >
            <ChevronRight size={16} />
          </button>
        </nav>
      </div>
    </footer>
  );
}
