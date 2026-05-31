import { useEffect, useRef, useState } from 'react';
import { HISTORY_KEY } from './constants.js';

export function useChatHistory() {
  const [chatHistory, setChatHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY) || '{}');
    } catch {
      return {};
    }
  });
  const historyRef = useRef(chatHistory);

  useEffect(() => {
    historyRef.current = chatHistory;
  }, [chatHistory]);

  function updateHistory(updater) {
    const next = updater(historyRef.current);
    historyRef.current = next;
    setChatHistory(next);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  }

  function recordReplyDetected(lead) {
    const reply = (lead.sms_reply || '').trim();
    if (!reply || reply === '.') return;
    const h = historyRef.current[lead.row_number] || {};
    if (h.lastReply === reply) return;

    updateHistory(prev => {
      const prevEntry = prev[lead.row_number] || {};
      const inboundDetectedAt = prevEntry.lastReply === reply
        ? (prevEntry.inboundDetectedAt || new Date().toISOString())
        : new Date().toISOString();
      return {
        ...prev,
        [lead.row_number]: {
          outbound: prevEntry.outbound || [],
          ...prevEntry,
          inboundDetectedAt,
          lastReply: reply,
        },
      };
    });
  }

  function saveSentMessage(rowNumber, text) {
    updateHistory(prev => {
      const entry = prev[rowNumber] || { outbound: [], inboundDetectedAt: null, lastReply: null };
      return {
        ...prev,
        [rowNumber]: {
          ...entry,
          outbound: [...entry.outbound, { text, ts: new Date().toISOString() }],
        },
      };
    });
  }

  return {
    chatHistory,
    historyRef,
    recordReplyDetected,
    saveSentMessage,
  };
}
