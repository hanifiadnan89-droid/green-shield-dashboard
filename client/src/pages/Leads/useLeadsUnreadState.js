import { useCallback, useEffect } from 'react';
import { useConversationThreads } from '../Replies/useConversationThreads.js';
import { useUnreadReplies } from '../Replies/useUnreadReplies.js';
import { filterConversationLeads, hasConversationSignal } from '../Replies/conversationLeadFilter.js';

/**
 * Same read/unread protocol as Replies: message sync + lastInboundAt vs lastReadAt.
 */
export function useLeadsUnreadState(leads) {
  const { threads, meta, syncLeads, syncing } = useConversationThreads();
  const { isUnread, markRead, applyMetaReadState, pulseRows } = useUnreadReplies();

  const conversationLeads = useMemo(() => filterConversationLeads(leads), [leads]);

  const syncConversationState = useCallback(async () => {
    if (!conversationLeads.length) return;
    await syncLeads(conversationLeads);
  }, [conversationLeads, syncLeads]);

  useEffect(() => {
    syncConversationState();
  }, [syncConversationState]);

  useEffect(() => {
    applyMetaReadState(meta);
  }, [meta, applyMetaReadState]);

  useEffect(() => {
    const refresh = () => { syncConversationState(); };
    window.addEventListener('replies-unread-count', refresh);
    return () => window.removeEventListener('replies-unread-count', refresh);
  }, [syncConversationState]);

  const isLeadUnread = useCallback((lead) => {
    if (!hasConversationSignal(lead)) return false;
    const row = lead.row_number;
    return isUnread(lead, threads[row] || [], meta[row]);
  }, [isUnread, threads, meta]);

  const markLeadRead = useCallback(async (lead) => {
    if (!hasConversationSignal(lead)) return null;
    const messages = threads[lead.row_number] || [];
    const result = await markRead(lead, messages);
    window.dispatchEvent(new CustomEvent('replies-unread-count'));
    return result;
  }, [markRead, threads]);

  return {
    isLeadUnread,
    markLeadRead,
    pulseRows,
    syncing,
    refreshReadState: syncConversationState,
  };
}
