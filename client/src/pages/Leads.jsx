import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../api/client.js';
import Spinner from '../components/Spinner.jsx';
import {
  CATEGORY_META,
  countQuickFilterLeads,
  filterLeads,
} from './Leads/leadsFilters.js';
import LeadsToolbar from './Leads/LeadsToolbar.jsx';
import LeadsTable from './Leads/LeadsTable.jsx';
import LeadsEmptyState from './Leads/LeadsEmptyState.jsx';
import EditLeadModal from './Leads/EditLeadModal.jsx';
import LeadDetailWorkspace from './Leads/LeadDetailWorkspace.jsx';
import LeadsAmbientBackground from './Leads/LeadsAmbientBackground.jsx';
import { useLeadsUnreadState } from './Leads/useLeadsUnreadState.js';
import { hasConversationSignal } from './Replies/conversationLeadFilter.js';
import './Leads/leads.css';

const EMPTY_FILTERS = { status: '', notes: '', stop: '', error: '', sms_reply: '', email_reply: '' };

export default function Leads() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const category = searchParams.get('category') || '';
  const categoryMeta = CATEGORY_META[category] || null;
  const notesParam = searchParams.get('notes') || '';

  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS });
  const [showFilters, setShowFilters] = useState(false);
  const [editLead, setEditLead] = useState(null);
  const [detailLead, setDetailLead] = useState(null);
  const [actionLoading, setActionLoading] = useState({});
  const [toast, setToast] = useState(null);
  const [quickFilter, setQuickFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { leads: data } = await api.leads.list();
      setLeads(data || []);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!detailLead?.row_number) return;
    setDetailLead(prev => {
      if (!prev) return prev;
      const updated = leads.find(l => l.row_number === prev.row_number);
      return updated || prev;
    });
  }, [leads, detailLead?.row_number]);

  useEffect(() => {
    setPage(1);
  }, [search, filters, category, notesParam, quickFilter]);

  const handleQuickFilter = useCallback((id) => {
    setQuickFilter(id);
    if (id === 'active') {
      setFilters({ ...EMPTY_FILTERS, status: 'active' });
    } else if (id === 'all' || id === 'archived') {
      setFilters({ ...EMPTY_FILTERS });
    } else {
      setFilters({ ...EMPTY_FILTERS });
    }
  }, []);

  const filtered = useMemo(
    () => filterLeads(leads, { search, filters, category, notesParam, quickFilter }),
    [leads, search, filters, category, notesParam, quickFilter],
  );

  const filterCounts = useMemo(() => countQuickFilterLeads(leads), [leads]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const handleStop = useCallback(async (lead) => {
    setActionLoading(p => ({ ...p, [`stop_${lead.row_number}`]: true }));
    try {
      const isStopped = lead.stop === 'yes';
      if (isStopped) {
        await api.leads.unstop(lead.row_number, lead.name);
        showToast(`${lead.name} — stop removed`);
      } else {
        await api.leads.stop(lead.row_number, lead.name);
        showToast(`${lead.name} — stop set. No more follow-ups.`, 'warn');
      }
      await load();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(p => ({ ...p, [`stop_${lead.row_number}`]: false }));
    }
  }, [load, showToast]);

  const handleMarkSold = useCallback(async (lead) => {
    if ((lead.sold || '').toLowerCase() === 'yes') return;
    const key = `sold_${lead.row_number}`;
    setActionLoading(p => ({ ...p, [key]: true }));
    try {
      await api.leads.update(lead.row_number, { ...lead, sold: 'yes' });
      showToast(`${lead.name} marked as sold`);
      await load();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(p => ({ ...p, [key]: false }));
    }
  }, [load, showToast]);

  const handleSaveEdit = useCallback(async (form) => {
    await api.leads.update(form.row_number, form);
    showToast(`${form.name} updated`);
    await load();
  }, [load, showToast]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const { isLeadUnread, markLeadRead, pulseRows } = useLeadsUnreadState(leads);

  const markedDetailRow = useRef(null);
  const detailLeadRef = useRef(null);
  detailLeadRef.current = detailLead;

  useEffect(() => {
    const row = detailLead?.row_number;
    if (!row || !detailLeadRef.current || !hasConversationSignal(detailLeadRef.current)) {
      markedDetailRow.current = null;
      return;
    }
    if (markedDetailRow.current === row) return;
    markedDetailRow.current = row;
    void markLeadRead(detailLeadRef.current);
  }, [detailLead?.row_number, markLeadRead]);

  return (
    <div className="leads-page">
      <LeadsAmbientBackground />
      <div className="leads-page__inner">
        <div className="lc-live-bar">
          <span className="lc-live" aria-live="polite">
            <motion.span
              className="lc-live__dot"
              animate={{ scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            Live mode
          </span>
        </div>

        {(categoryMeta || notesParam) && (
          <div className="leads-banner">
            <span className="w-1 h-7 rounded-full bg-[#4ade80] shrink-0" />
            <div className="min-w-0">
              <h1>
                {categoryMeta?.label ?? (
                  <>Template: <span className="uppercase">{notesParam}</span></>
                )}
              </h1>
              <p>
                {categoryMeta?.desc ?? 'Showing leads with this template'}
              </p>
            </div>
            <Link to="/leads">← All leads</Link>
          </div>
        )}

        <LeadsToolbar
          search={search}
          onSearchChange={setSearch}
          totalLeads={leads.length}
          allLeads={leads}
          loading={loading}
          onRefresh={load}
          showFilters={showFilters}
          onToggleFilters={() => setShowFilters(p => !p)}
          filters={filters}
          onFiltersChange={setFilters}
          activeFilterCount={activeFilterCount}
          onClearFilters={() => setFilters({ ...EMPTY_FILTERS })}
          quickFilter={quickFilter}
          onQuickFilterChange={handleQuickFilter}
          category={category}
          notesParam={notesParam}
          filterCounts={filterCounts}
        />

        <AnimatePresence>
          {toast && (
            <motion.div
              className={`leads-toast leads-toast--${toast.type === 'error' ? 'error' : toast.type === 'warn' ? 'warn' : 'success'}`}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              {toast.msg}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="leads-workspace-layout">
          <div className="leads-main">
            <div className="leads-table-shell leads-table-shell--split">
              <div className="leads-table-panel">
                {loading ? (
                  <div className="flex justify-center py-20">
                    <Spinner />
                  </div>
                ) : filtered.length === 0 ? (
                  <LeadsEmptyState search={search} categoryMeta={categoryMeta} />
                ) : (
                  <LeadsTable
                    data={paginated}
                    totalCount={filtered.length}
                    page={page}
                    pageSize={pageSize}
                    onPageChange={setPage}
                    onPageSizeChange={size => {
                      setPageSize(size);
                      setPage(1);
                    }}
                    selectedRowNumber={detailLead?.row_number ?? null}
                    onRowClick={setDetailLead}
                    navigate={navigate}
                    onStop={handleStop}
                    onEdit={setEditLead}
                    onMarkSold={handleMarkSold}
                    actionLoading={actionLoading}
                    isLeadUnread={isLeadUnread}
                    pulseRows={pulseRows}
                  />
                )}
              </div>
            </div>
          </div>

          <AnimatePresence>
            {detailLead && (
              <LeadDetailWorkspace
                lead={detailLead}
                onClose={() => setDetailLead(null)}
                onLeadUpdated={load}
              />
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {editLead && (
          <EditLeadModal
            lead={editLead}
            onClose={() => setEditLead(null)}
            onSave={handleSaveEdit}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
