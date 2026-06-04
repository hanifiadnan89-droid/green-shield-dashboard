import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client.js';
import { buildThreadFromMessages } from '../Replies/threadUtils.js';
import { deriveLeadInsights } from './deriveLeadInsights.js';
import { isLeadArchived } from './leadsFilters.js';
import { parseLeadName } from './parseLeadName.js';

export function useLeadDetailData(lead) {
  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState([]);
  const [messages, setMessages] = useState([]);
  const [meta, setMeta] = useState({});
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    if (!lead?.row_number) return undefined;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const [actRes, msgRes] = await Promise.all([
          api.activity.list(120),
          api.messages.list(lead.row_number),
        ]);

        let syncedMessages = msgRes.messages || [];
        let syncedMeta = msgRes.meta || {};

        try {
          const syncRes = await api.messages.sync([lead], []);
          syncedMessages = syncRes.threads?.[lead.row_number] || syncedMessages;
          syncedMeta = { ...syncedMeta, ...(syncRes.meta?.[lead.row_number] || {}) };
        } catch {
          /* sync optional */
        }

        if (cancelled) return;

        const { displayName, rawName } = parseLeadName(lead.name);
        const nameKeys = new Set(
          [lead.name, rawName, displayName].filter(Boolean).map(n => n.toLowerCase())
        );
        const log = (actRes.log || []).filter(
          e => e.leadName && nameKeys.has(e.leadName.toLowerCase())
        );

        setActivity(log.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
        setMessages(syncedMessages);
        setMeta(syncedMeta);
      } catch (err) {
        if (!cancelled) setLoadError(err.message || 'Failed to load lead details');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [lead?.row_number, lead?.name]);

  const thread = useMemo(
    () => buildThreadFromMessages(messages, lead, {}),
    [messages, lead]
  );

  const insights = useMemo(
    () => deriveLeadInsights(lead, activity, thread, meta),
    [lead, activity, thread, meta]
  );

  const replyArchived = useMemo(() => isLeadArchived(lead), [lead]);

  return { loading, loadError, activity, messages, thread, meta, insights, replyArchived };
}
