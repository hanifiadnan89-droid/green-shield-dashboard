import { useState, useCallback } from 'react';

/**
 * Manages a single in-memory Sales Coach session.
 *
 * Sessions are not persisted to the server yet, but every API payload
 * includes the sessionId so the backend is ready to store them.
 *
 * Session model:
 *   id, createdAt, updatedAt, module, customerName, serviceType,
 *   situation, outcome, status ('active'|'completed'|'abandoned'),
 *   lastResultSummary
 */
export function useSalesCoachSession(module) {
  const [session, setSession] = useState(null);

  const startSession = useCallback((initialData = {}) => {
    const now = new Date().toISOString();
    const s = {
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      module,
      customerName:      initialData.customerName || null,
      serviceType:       initialData.serviceType  || null,
      situation:         initialData.situation    || null,
      outcome:           null,
      status:            'active',
      lastResultSummary: null,
    };
    setSession(s);
    return s;
  }, [module]);

  const updateSession = useCallback((updates) => {
    setSession(prev => prev
      ? { ...prev, ...updates, updatedAt: new Date().toISOString() }
      : null);
  }, []);

  const completeSession = useCallback((outcomeId, summary = null) => {
    setSession(prev => prev
      ? {
          ...prev,
          outcome:           outcomeId,
          status:            'completed',
          lastResultSummary: summary,
          updatedAt:         new Date().toISOString(),
        }
      : null);
  }, []);

  const abandonSession = useCallback(() => {
    setSession(prev => prev
      ? { ...prev, status: 'abandoned', updatedAt: new Date().toISOString() }
      : null);
  }, []);

  return { session, startSession, updateSession, completeSession, abandonSession };
}
