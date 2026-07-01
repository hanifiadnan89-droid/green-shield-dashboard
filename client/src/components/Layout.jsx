import { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../api/client.js';
import { filterConversationLeads } from '../pages/Replies/conversationLeadFilter.js';
import { loadLegacyViewedKeys } from '../pages/Replies/legacyViewedKeys.js';
import { deriveStats } from '../pages/CRMPreview/mockData.js';
import AppSidebar from './AppSidebar.jsx';

const SIDEBAR_REFRESH_MS = 45_000;

export default function Layout({ children, testMode, currentUser }) {
  const [replyBadge, setReplyBadge] = useState(0);
  const [stats, setStats] = useState(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const compute = async () => {
      if (cancelled || document.hidden || inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        const { leads } = await api.leads.list();
        if (cancelled) return;
        setStats(deriveStats(leads || []));
        const replyLeads = filterConversationLeads(leads);
        if (!replyLeads.length) {
          setReplyBadge(0);
          return;
        }
        const { count } = await api.messages.unreadCount(replyLeads, loadLegacyViewedKeys());
        if (!cancelled) setReplyBadge(count);
      } catch {
        /* keep previous badge/stats on transient errors */
      } finally {
        inFlightRef.current = false;
      }
    };

    compute();

    const intervalId = setInterval(compute, SIDEBAR_REFRESH_MS);

    const onVisibility = () => {
      if (!document.hidden) compute();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibility);
    };
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
    <div className="flex h-screen overflow-hidden app-shell">
      <AppSidebar
        stats={sidebarStats}
        testMode={testMode}
        currentUser={currentUser}
        unreadReplies={replyBadge}
      />

      <div className="flex-1 flex flex-col overflow-hidden app-shell__main min-w-0 w-full">
        {children}
      </div>
    </div>
  );
}
