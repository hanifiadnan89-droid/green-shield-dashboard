import { useState, useEffect, useMemo } from 'react';
import { api } from '../api/client.js';
import { filterConversationLeads } from '../pages/Replies/conversationLeadFilter.js';
import { loadLegacyViewedKeys } from '../pages/Replies/legacyViewedKeys.js';
import { deriveStats } from '../pages/CRMPreview/mockData.js';
import AppSidebar from './AppSidebar.jsx';

export default function Layout({ children, testMode }) {
  const [replyBadge, setReplyBadge] = useState(0);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const compute = async () => {
      try {
        const { leads } = await api.leads.list();
        setStats(deriveStats(leads || []));
        const replyLeads = filterConversationLeads(leads);
        if (!replyLeads.length) {
          setReplyBadge(0);
          return;
        }
        const { count } = await api.messages.unreadCount(replyLeads, loadLegacyViewedKeys());
        setReplyBadge(count);
      } catch {
        /* keep previous badge/stats on transient errors */
      }
    };
    compute();
    const id = setInterval(compute, 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (typeof e.detail?.count === 'number') {
        setReplyBadge(e.detail.count);
      }
    };
    window.addEventListener('replies-unread-count', handler);
    return () => window.removeEventListener('replies-unread-count', handler);
  }, []);

  const sidebarStats = useMemo(() => stats, [stats]);

  return (
    <div className="flex h-screen overflow-hidden bg-gs-bg">
      <AppSidebar
        stats={sidebarStats}
        testMode={testMode}
        unreadReplies={replyBadge}
      />

      <div className="flex-1 flex flex-col overflow-hidden bg-gs-bg min-w-0 w-full">
        {children}
      </div>
    </div>
  );
}
