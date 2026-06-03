import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  /** Baseline preview when not hovering (first visible / last valid in list) */
  const [selectedLead, setSelectedLead] = useState(null);
  /** Transient hover — cleared on mouse leave and list scroll */
  const [hoveredLead, setHoveredLead] = useState(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (!filteredLeads.length) {
      setSelectedLead(null);
      setHoveredLead(null);
      return;
    }
    setSelectedLead(prev => {
      if (prev && filteredLeads.some(l => l.row_number === prev.row_number)) return prev;
      return filteredLeads[0];
    });
    setHoveredLead(null);
  }, [filteredLeads]);

  const previewLead = useMemo(
    () => hoveredLead ?? selectedLead,
    [hoveredLead, selectedLead],
  );

  const handleHover = useCallback((lead) => {
    if (lead) {
      setHoveredLead(lead);
    } else {
      setHoveredLead(null);
    }
  }, []);

  const handleListScroll = useCallback(() => {
    setHoveredLead(null);
  }, []);

  const handleListMouseLeave = useCallback(() => {
    setHoveredLead(null);
  }, []);

  const handleSelectFromList = useCallback((lead) => {
    setSelectedLead(lead);
    onSelectLead(lead);
  }, [onSelectLead]);

  const handleContinue = useCallback((lead) => {
    setSelectedLead(lead);
    onSelectLead(lead);
  }, [onSelectLead]);

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
              <ul
                ref={listRef}
                className="send-pick-lead__cards"
                role="list"
                onScroll={handleListScroll}
                onMouseLeave={handleListMouseLeave}
              >
                <AnimatePresence mode="popLayout">
                  {filteredLeads.map((lead, index) => (
                    <LeadCard
                      key={lead.row_number}
                      lead={lead}
                      index={index}
                      highlighted={previewLead?.row_number === lead.row_number}
                      onHover={handleHover}
                      onSelect={handleSelectFromList}
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
          lead={previewLead}
          onContinue={handleContinue}
        />
      </div>
    </motion.div>
  );
}
