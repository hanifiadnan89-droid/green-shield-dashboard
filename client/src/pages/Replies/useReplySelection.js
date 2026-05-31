import { useEffect, useState, useMemo, useRef } from 'react';

/**
 * Tracks the selected conversation in the inbox layout.
 * Auto-selects first active lead; re-syncs when lists change (archive, search, refresh).
 */
export function useReplySelection({ activeLeads, archivedLeads, showArchived, loading }) {
  const [selectedRowNumber, setSelectedRowNumber] = useState(null);
  const skipAutoSelectRef = useRef(false);

  const allVisibleLeads = useMemo(
    () => (showArchived ? [...activeLeads, ...archivedLeads] : activeLeads),
    [activeLeads, archivedLeads, showArchived]
  );

  useEffect(() => {
    if (loading) return;

    if (skipAutoSelectRef.current) {
      skipAutoSelectRef.current = false;
      return;
    }

    if (selectedRowNumber != null) {
      const stillVisible = allVisibleLeads.some(l => l.row_number === selectedRowNumber);
      if (stillVisible) return;
    }

    if (activeLeads.length > 0) {
      setSelectedRowNumber(activeLeads[0].row_number);
    } else if (showArchived && archivedLeads.length > 0) {
      setSelectedRowNumber(archivedLeads[0].row_number);
    } else {
      setSelectedRowNumber(null);
    }
  }, [activeLeads, archivedLeads, showArchived, loading, allVisibleLeads, selectedRowNumber]);

  function selectLead(rowNumber) {
    setSelectedRowNumber(rowNumber);
  }

  function clearSelection() {
    skipAutoSelectRef.current = true;
    setSelectedRowNumber(null);
  }

  /** After archiving the current lead, select the next active row if any. */
  function selectAfterArchive(archivedRowNumber) {
    const remaining = activeLeads.filter(l => l.row_number !== archivedRowNumber);
    if (remaining.length > 0) {
      setSelectedRowNumber(remaining[0].row_number);
    } else if (showArchived && archivedLeads.length > 0) {
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
