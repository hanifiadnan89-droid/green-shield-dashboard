import { useMemo, useCallback, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import Spinner from '../../components/Spinner.jsx';
import LeadsAmbientBackground from '../Leads/LeadsAmbientBackground.jsx';
import useFollowups from './useFollowups.js';
import FollowupsToolbar from './FollowupsToolbar.jsx';
import FollowupsKpiRow from './FollowupsKpiRow.jsx';
import FollowupsQuickFilters from './FollowupsQuickFilters.jsx';
import FollowupsTable from './FollowupsTable.jsx';
import FollowupsDetailPanel from './FollowupsDetailPanel.jsx';
import FollowupsEmptyState from './FollowupsEmptyState.jsx';
import FollowupsStopConfirm from './FollowupsStopConfirm.jsx';
import { QUICK_FILTERS, applyQuickFilter } from './followupsUtils.js';
import './followups.css';

function filterBySearch(leads, query) {
  const q = query.trim().toLowerCase();
  if (!q) return leads;
  return leads.filter((lead) => {
    const haystack = [
      lead.name,
      lead.phone,
      lead.email,
      lead.notes,
      lead.status,
      lead.error,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

export default function FollowupsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [showFiltersHint, setShowFiltersHint] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const {
    inFlightLeads,
    allLeads,
    filteredLeads,
    kpis,
    loading,
    quickFilter,
    setQuickFilter,
    selectedLead,
    setSelectedLead,
    stopLoading,
    confirmStopLead,
    setConfirmStopLead,
    handleStopRequest,
    handleStopConfirm,
    load,
    toast,
  } = useFollowups();

  const filterCounts = useMemo(() => {
    const counts = {};
    for (const f of QUICK_FILTERS) {
      counts[f.id] = applyQuickFilter(f.id, inFlightLeads, allLeads).length;
    }
    return counts;
  }, [inFlightLeads, allLeads]);

  const searchedLeads = useMemo(
    () => filterBySearch(filteredLeads, search),
    [filteredLeads, search],
  );

  useEffect(() => {
    setPage(1);
  }, [search, quickFilter]);

  const totalPages = Math.max(1, Math.ceil(searchedLeads.length / pageSize));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paginatedLeads = useMemo(() => {
    const start = (page - 1) * pageSize;
    return searchedLeads.slice(start, start + pageSize);
  }, [searchedLeads, page, pageSize]);

  const activeFilterLabel = QUICK_FILTERS.find(f => f.id === quickFilter)?.label || 'All';
  const activeFilterCount = quickFilter !== 'all' ? 1 : 0;

  const handleSendAgain = useCallback((lead) => {
    navigate('/send', { state: { lead } });
  }, [navigate]);

  return (
    <div className="followups-page">
      <LeadsAmbientBackground />
      <div className="followups-page__inner">
        <div className="lc-live-bar">
          <span className="lc-live" aria-live="polite">
            <motion.span
              className="lc-live__dot"
              animate={{ scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            Live mode
          </span>
        </div>

        <FollowupsToolbar
          search={search}
          onSearchChange={setSearch}
          loading={loading}
          onRefresh={load}
          showFilters={showFiltersHint}
          onToggleFilters={() => setShowFiltersHint(p => !p)}
          activeFilterCount={activeFilterCount}
        />

        <div className="followups-scroll">
          <section className="fc-kpi-section" aria-label="Follow-up metrics">
            <FollowupsKpiRow
              kpis={kpis}
              loading={loading}
              allLeads={allLeads}
              inFlightLeads={inFlightLeads}
            />
          </section>

          <div className="fc-filters-wrap">
            <FollowupsQuickFilters
              value={quickFilter}
              onChange={setQuickFilter}
              counts={filterCounts}
            />
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(n => (
                <div key={n} className="followups-skeleton-row" />
              ))}
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            </div>
          ) : searchedLeads.length === 0 ? (
            <FollowupsEmptyState filterLabel={activeFilterLabel} search={search} />
          ) : (
            <motion.div
              className="followups-main"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <FollowupsTable
                leads={paginatedLeads}
                totalCount={searchedLeads.length}
                page={page}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
                selectedLead={selectedLead}
                onSelect={setSelectedLead}
                stopLoading={stopLoading}
                onStop={handleStopRequest}
                onSendAgain={handleSendAgain}
              />

              <AnimatePresence>
                {selectedLead && (
                  <>
                    <div
                      className="fixed inset-0 z-[65] bg-black/50 lg:hidden"
                      onClick={() => setSelectedLead(null)}
                      aria-hidden
                    />
                    <FollowupsDetailPanel
                      key={selectedLead.row_number}
                      lead={selectedLead}
                      onClose={() => setSelectedLead(null)}
                      onStop={handleStopRequest}
                      onSendAgain={handleSendAgain}
                      stopLoading={stopLoading}
                    />
                  </>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </div>

      <FollowupsStopConfirm
        lead={confirmStopLead}
        onConfirm={handleStopConfirm}
        onCancel={() => setConfirmStopLead(null)}
      />

      <AnimatePresence>
        {toast && (
          <motion.div
            className={`followups-toast followups-toast--${toast.type === 'error' ? 'error' : 'success'}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
