import { useState } from 'react';
import { ARCHIVE_KEY } from './constants.js';
import { archKey } from './threadUtils.js';

export function useReplyArchive() {
  const [archived, setArchived] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(ARCHIVE_KEY) || '[]'));
    } catch {
      return new Set();
    }
  });
  const [showArchived, setShowArchived] = useState(false);
  const [archiveConfirm, setArchiveConfirm] = useState(null);

  function archiveLead(lead) {
    setArchived(prev => {
      const next = new Set(prev);
      next.add(archKey(lead));
      localStorage.setItem(ARCHIVE_KEY, JSON.stringify([...next]));
      return next;
    });
    setArchiveConfirm(null);
  }

  function restoreLead(lead) {
    setArchived(prev => {
      const next = new Set(prev);
      next.delete(archKey(lead));
      localStorage.setItem(ARCHIVE_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  function isArchived(lead) {
    return archived.has(archKey(lead));
  }

  return {
    archived,
    showArchived,
    setShowArchived,
    archiveConfirm,
    setArchiveConfirm,
    archiveLead,
    restoreLead,
    isArchived,
    archivedCount: archived.size,
    archKey,
  };
}
