import { useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import Spinner from '../../components/Spinner.jsx';
import useFollowups from './useFollowups.js';
import FollowupsKpiRow from './FollowupsKpiRow.jsx';
import FollowupsQuickFilters from './FollowupsQuickFilters.jsx';
import FollowupsTable from './FollowupsTable.jsx';
import FollowupsDetailPanel from './FollowupsDetailPanel.jsx';
import FollowupsEmptyState from './FollowupsEmptyState.jsx';
import FollowupsStopConfirm from './FollowupsStopConfirm.jsx';
import { QUICK_FILTERS, applyQuickFilter } from './followupsUtils.js';
import './followups.css';

export default function FollowupsPage() {
  const navigate = useNavigate();
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
    toast,
  } = useFollowups();

  const filterCounts = useMemo(() => {
    const counts = {};
    for (const f of QUICK_FILTERS) {
      counts[f.id] = applyQuickFilter(f.id, inFlightLeads, allLeads).length;
    }
    return counts;
  }, [inFlightLeads, allLeads]);

  const activeFilterLabel = QUICK_FILTERS.find(f => f.id === quickFilter)?.label || 'All';

  const handleSendAgain = useCallback((lead) => {
    navigate('/send', { state: { lead } });
  }, [navigate]);

  return (
    <div className="followups-page">
      <div className="followups-scroll">
        <FollowupsKpiRow kpis={kpis} loading={loading} />

        <FollowupsQuickFilters
          value={quickFilter}
          onChange={setQuickFilter}
          counts={filterCounts}
        />

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(n => (
              <div key={n} className="followups-skeleton-row" />
            ))}
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          </div>
        ) : filteredLeads.length === 0 ? (
          <FollowupsEmptyState filterLabel={activeFilterLabel} />
        ) : (
          <motion.div
            className="followups-main"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <FollowupsTable
              leads={filteredLeads}
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
                    className="fixed inset-0 z-[65] bg-black/20 lg:hidden"
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
