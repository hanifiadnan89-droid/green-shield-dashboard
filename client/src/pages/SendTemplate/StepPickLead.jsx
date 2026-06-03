import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import Spinner from '../../components/Spinner.jsx';
import LeadSearchPanel from './LeadSearchPanel.jsx';
import LeadCard from './LeadCard.jsx';
import LeadPreviewPanel from './LeadPreviewPanel.jsx';
import { EmptyLeadListState, EmptySearchState } from './EmptyLeadState.jsx';

const EASE = [0.22, 1, 0.36, 1];

export default function StepPickLead({
  search,
  onSearchChange,
  leadsLoading,
  filteredLeads,
  allLeadsCount,
  onSelectLead,
}) {
  const [highlightedLead, setHighlightedLead] = useState(null);

  useEffect(() => {
    if (!filteredLeads.length) {
      setHighlightedLead(null);
      return;
    }
    setHighlightedLead(prev => {
      if (prev && filteredLeads.some(l => l.row_number === prev.row_number)) return prev;
      return filteredLeads[0];
    });
  }, [filteredLeads]);

  return (
    <motion.div
      className="send-pick-lead"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      <div className="send-pick-lead__workspace">
        <div className="send-pick-lead__list-panel">
          <LeadSearchPanel
            search={search}
            onSearchChange={onSearchChange}
            resultCount={filteredLeads.length}
            totalCount={allLeadsCount}
          />

          {leadsLoading ? (
            <div className="send-pick-lead__loading flex-1">
              <Spinner size={28} />
              <p className="type-label-sm text-gs-muted">Loading leads…</p>
            </div>
          ) : allLeadsCount === 0 ? (
            <EmptyLeadListState />
          ) : (
            <>
              <ul className="send-pick-lead__cards" role="list">
                <AnimatePresence mode="popLayout">
                  {filteredLeads.map((lead, index) => (
                    <LeadCard
                      key={lead.row_number}
                      lead={lead}
                      index={index}
                      highlighted={highlightedLead?.row_number === lead.row_number}
                      onHover={setHighlightedLead}
                      onSelect={onSelectLead}
                    />
                  ))}
                </AnimatePresence>
              </ul>
              <AnimatePresence>
                {filteredLeads.length === 0 && search && (
                  <EmptySearchState query={search} />
                )}
              </AnimatePresence>
            </>
          )}
        </div>

        <LeadPreviewPanel
          lead={highlightedLead}
          onContinue={onSelectLead}
        />
      </div>
    </motion.div>
  );
}
