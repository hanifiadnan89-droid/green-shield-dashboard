import { useState } from 'react';

const DEFAULT_CARD = {
  message: '',
  sending: false,
  sent: false,
  error: null,
  sentAt: null,
  drafting: false,
  draftError: null,
  reviewRequired: false,
  reviewReason: null,
};

export function useReplyCardState() {
  const [cardState, setCardState] = useState({});

  function getCard(rowNumber) {
    return cardState[rowNumber] || DEFAULT_CARD;
  }

  function updateCard(rowNumber, patch) {
    setCardState(prev => ({
      ...prev,
      [rowNumber]: { ...(prev[rowNumber] || DEFAULT_CARD), ...patch },
    }));
  }

  return { getCard, updateCard };
}
