import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client.js';
import {
  applyQuickFilter,
  computeKpis,
  isInFlightFollowup,
} from './followupsUtils.js';

export default function useFollowups() {
  const [allLeads, setAllLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [quickFilter, setQuickFilter] = useState('all');
  const [selectedLead, setSelectedLead] = useState(null);
  const [stopLoading, setStopLoading] = useState({});
  const [confirmStopLead, setConfirmStopLead] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { leads: data } = await api.leads.list();
      const list = data || [];
      setAllLeads(list);
      setLastRefreshed(new Date());
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const inFlightLeads = useMemo(
    () => allLeads.filter(isInFlightFollowup),
    [allLeads]
  );

  const kpis = useMemo(
    () => computeKpis(allLeads, inFlightLeads),
    [allLeads, inFlightLeads]
  );

  const filteredLeads = useMemo(
    () => applyQuickFilter(quickFilter, inFlightLeads, allLeads),
    [quickFilter, inFlightLeads, allLeads]
  );

  useEffect(() => {
    if (!selectedLead?.row_number) return;
    const updated = allLeads.find(l => l.row_number === selectedLead.row_number);
    if (updated) setSelectedLead(updated);
    else setSelectedLead(null);
  }, [allLeads, selectedLead?.row_number]);

  const handleStopRequest = useCallback((lead) => {
    setConfirmStopLead(lead);
  }, []);

  const handleStopConfirm = useCallback(async () => {
    const lead = confirmStopLead;
    if (!lead) return;
    setConfirmStopLead(null);
    setStopLoading(p => ({ ...p, [lead.row_number]: true }));
    try {
      await api.leads.stop(lead.row_number, lead.name);
      showToast(`${lead.name} — follow-ups stopped`);
      await load();
      if (selectedLead?.row_number === lead.row_number) {
        setSelectedLead(null);
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setStopLoading(p => ({ ...p, [lead.row_number]: false }));
    }
  }, [confirmStopLead, load, selectedLead?.row_number, showToast]);

  return {
    allLeads,
    inFlightLeads,
    filteredLeads,
    kpis,
    loading,
    lastRefreshed,
    quickFilter,
    setQuickFilter,
    selectedLead,
    setSelectedLead,
    stopLoading,
    confirmStopLead,
    setConfirmStopLead,
    handleStopRequest,
    handleStopConfirm,
    load,
    toast,
  };
}
