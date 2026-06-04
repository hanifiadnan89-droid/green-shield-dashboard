import { useEffect, useState, useMemo, useRef } from 'react';
import { archKey } from './threadUtils.js';

const LG_BREAKPOINT = '(min-width: 1024px)';

function isDesktopViewport() {
  return typeof window !== 'undefined' && window.matchMedia(LG_BREAKPOINT).matches;
}

/**
 * Tracks the selected conversation in the inbox layout.
 * Desktop: auto-selects first visible lead when none or stale.
 * Mobile: list-first until the user picks a thread; clears detail when filter/archive hides selection.
 */
export function useReplySelection({
  activeLeads,
  archivedLeads,
  showArchived,
  loading,
  searchQuery = '',
}) {
  const [selectedRowNumber, setSelectedRowNumber] = useState(null);
  const skipAutoSelectRef = useRef(false);
  const initialMobileListRef = useRef(true);

  const allVisibleLeads = useMemo(
    () => (showArchived ? [...activeLeads, ...archivedLeads] : activeLeads),
    [activeLeads, archivedLeads, showArchived]
  );

  function pickDefaultRowNumber() {
    if (activeLeads.length > 0) return activeLeads[0].row_number;
    if (showArchived && archivedLeads.length > 0) return archivedLeads[0].row_number;
    return null;
  }

  const hasActiveSearch = Boolean(String(searchQuery || '').trim());

  useEffect(() => {
    if (loading) return;

    if (skipAutoSelectRef.current) {
      skipAutoSelectRef.current = false;
      return;
    }

    if (hasActiveSearch && selectedRowNumber != null) {
      return;
    }

    if (selectedRowNumber != null) {
      const stillVisible = allVisibleLeads.some(l => l.row_number === selectedRowNumber);
      if (stillVisible) {
        initialMobileListRef.current = false;
        return;
      }
      if (!isDesktopViewport()) {
        skipAutoSelectRef.current = true;
        setSelectedRowNumber(null);
        initialMobileListRef.current = false;
        return;
      }
    } else if (initialMobileListRef.current && !isDesktopViewport()) {
      initialMobileListRef.current = false;
      return;
    }

    initialMobileListRef.current = false;
    setSelectedRowNumber(pickDefaultRowNumber());
  }, [
    activeLeads,
    archivedLeads,
    showArchived,
    loading,
    allVisibleLeads,
    selectedRowNumber,
    hasActiveSearch,
  ]);

  function selectLead(rowNumber) {
    initialMobileListRef.current = false;
    setSelectedRowNumber(rowNumber);
  }

  function clearSelection() {
    skipAutoSelectRef.current = true;
    initialMobileListRef.current = false;
    setSelectedRowNumber(null);
  }

  /** After archiving the current lead, select the next active row if any. */
  function selectAfterArchive(archivedRowNumber) {
    const remaining = activeLeads.filter(l => l.row_number !== archivedRowNumber);
    if (remaining.length > 0) {
      setSelectedRowNumber(remaining[0].row_number);
      return;
    }
    if (!isDesktopViewport()) {
      skipAutoSelectRef.current = true;
      setSelectedRowNumber(null);
      return;
    }
    if (showArchived && archivedLeads.length > 0) {
      setSelectedRowNumber(archivedLeads[0].row_number);
    } else {
      setSelectedRowNumber(null);
    }
  }

  function isArchivedLead(lead, archivedSet) {
    return archivedSet.has(archKey(lead));
  }

  return {
    selectedRowNumber,
    selectLead,
    clearSelection,
    selectAfterArchive,
    isArchivedLead,
    detailOpen: selectedRowNumber != null,
  };
}
